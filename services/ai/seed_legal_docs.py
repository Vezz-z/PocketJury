"""
PocketJury — Seed Legal Documents with Embeddings

Seeds the database with sample Indian legal documents and generates embeddings
so that the RAG pipeline returns grounded answers for demo queries.

Usage:
    docker compose exec ai python seed_legal_docs.py
"""

import asyncio
import uuid
from datetime import datetime, date

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.core.embedder import EmbedderService

settings = get_settings()

# ── Sample Legal Documents ──────────────────────────────────────────────────

LEGAL_DOCUMENTS = [
    {
        "document_type": "CONSTITUTION",
        "title": "Constitution of India — Part III: Fundamental Rights",
        "act_name": "Constitution of India",
        "section_number": "Articles 14-32",
        "body_text": """Part III of the Constitution of India guarantees fundamental rights to all citizens. Article 14 ensures equality before law. Article 19 protects freedoms of speech, assembly, association, movement, residence, and profession. Article 21 guarantees the right to life and personal liberty — the Supreme Court has interpreted this to include the right to livelihood, education, health, clean environment, privacy, and dignity. Article 21A provides the right to free and compulsory education for children aged 6-14. Article 22 provides protection against arrest and detention. Article 23 prohibits human trafficking and forced labour. Article 25-28 guarantee freedom of religion. Article 32 provides the right to constitutional remedies — Dr. B.R. Ambedkar called it "the heart and soul of the Constitution".""",
        "source_url": "https://legislative.gov.in/constitution-of-india",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "1950-01-26",
        "year": 1950,
    },
    {
        "document_type": "STATUTE",
        "title": "Bharatiya Nyaya Sanhita, 2023 — Chapter V: Offences Against Woman and Child",
        "act_name": "Bharatiya Nyaya Sanhita, 2023",
        "section_number": "Sections 63-99",
        "body_text": """The Bharatiya Nyaya Sanhita (BNS), 2023 replaced the Indian Penal Code (IPC) effective July 1, 2024. Chapter V deals with offences against women and children. Section 63 (replacing IPC 375/376) defines and punishes rape with rigorous imprisonment of not less than 10 years. Section 64 addresses punishment for rape. Section 69 covers sexual intercourse by employing deceitful means. Section 74 (replacing IPC 354) punishes assault or criminal force on a woman with intent to outrage her modesty. Section 75 addresses sexual harassment. Section 76 punishes voyeurism. Section 77 punishes stalking. Section 79 (replacing IPC 498A) addresses cruelty by husband or his relatives — punishable with up to 3 years imprisonment. Section 85 covers kidnapping of a woman to compel marriage. Section 95 defines offences relating to child marriage.""",
        "source_url": "https://legislative.gov.in/bns-2023-chapter-v",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2024-07-01",
        "year": 2023,
    },
    {
        "document_type": "STATUTE",
        "title": "Bharatiya Nyaya Sanhita, 2023 — Chapter VI: Offences Against Property",
        "act_name": "Bharatiya Nyaya Sanhita, 2023",
        "section_number": "Sections 303-334",
        "body_text": """Chapter VI of the BNS deals with offences against property. Section 303 (replacing IPC 378) defines theft — whoever intending to take dishonestly any moveable property out of the possession of any person without that person's consent. Section 305 (replacing IPC 380) addresses theft in a dwelling house — punishable with up to 7 years. Section 308 (replacing IPC 383) defines extortion. Section 309 (replacing IPC 384) punishes extortion with up to 3 years. Section 310 (replacing IPC 390) defines robbery. Section 311 (replacing IPC 391) defines dacoity — when 5 or more persons commit robbery. Section 316 (replacing IPC 403) defines criminal misappropriation. Section 318 (replacing IPC 405) defines criminal breach of trust. Section 329 (replacing IPC 420) defines cheating and dishonestly inducing delivery of property — punishable with up to 7 years and fine. Section 331 (replacing IPC 425) defines mischief — causing wrongful loss or damage to property.""",
        "source_url": "https://legislative.gov.in/bns-2023-chapter-vi",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2024-07-01",
        "year": 2023,
    },
    {
        "document_type": "STATUTE",
        "title": "Consumer Protection Act, 2019 — Key Provisions",
        "act_name": "Consumer Protection Act, 2019",
        "section_number": "Sections 2, 34-73",
        "body_text": """The Consumer Protection Act, 2019 replaced the 1986 Act to strengthen consumer rights. Section 2(7) defines "consumer" as any person who buys goods or hires services for consideration. Section 2(9) lists consumer rights including the right to be protected against marketing of hazardous goods, right to be informed, right to choose, right to be heard, and right to seek redressal. The Act establishes a three-tier quasi-judicial consumer disputes redressal mechanism: District Commission (claims up to ₹1 crore), State Commission (₹1 crore to ₹10 crore), and National Commission (above ₹10 crore). Section 35 provides for filing of complaints. Section 38 covers the procedure for hearing. Chapter VI introduces product liability — manufacturers, sellers, and service providers are liable for defective products/services. Section 89-91 establish the Central Consumer Protection Authority (CCPA) for class-action and regulation. Consumer Helpline: 14566 or 1800-11-4000 (toll-free).""",
        "source_url": "https://legislative.gov.in/consumer-protection-act-2019",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2020-07-20",
        "year": 2019,
    },
    {
        "document_type": "STATUTE",
        "title": "Right to Information Act, 2005",
        "act_name": "Right to Information Act, 2005",
        "section_number": "Sections 3-20",
        "body_text": """The Right to Information (RTI) Act, 2005 empowers Indian citizens to access information from public authorities. Section 3 establishes that all citizens have the right to information. Section 6 prescribes how to make an RTI request — submit to the Public Information Officer (PIO) of the relevant authority with a fee of ₹10. Section 7 requires a response within 30 days (48 hours if life/liberty is involved). Section 8 lists exemptions including national security, trade secrets, and personal information. Section 19 provides a two-tier appeal mechanism: First Appeal to a senior officer within the authority (within 30 days), Second Appeal to the Information Commission (within 90 days). Section 20 provides penalties for PIO non-compliance — ₹250/day up to ₹25,000. The Act applies to all public authorities — Central, State, and local governments, and bodies owned/substantially financed by the government.""",
        "source_url": "https://legislative.gov.in/rti-act-2005",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2005-10-12",
        "year": 2005,
    },
    {
        "document_type": "STATUTE",
        "title": "Transfer of Property Act, 1882 — Lease and Rent",
        "act_name": "Transfer of Property Act, 1882",
        "section_number": "Sections 105-117",
        "body_text": """Sections 105-117 of the Transfer of Property Act, 1882 govern leases of immovable property. Section 105 defines a lease — a transfer of the right to enjoy immovable property for a certain time in consideration of rent. Section 106 specifies default lease durations: agricultural/manufacturing — year-to-year; other purposes — month-to-month. Either party can terminate by 15 days' notice (monthly lease) or 6 months' notice (yearly lease). Section 107 requires leases exceeding one year to be registered. Section 108 lists tenant rights and obligations: (a) the landlord must disclose material defects, (b) the tenant has the right to peaceful possession, (c) the tenant must pay rent, keep the property in good repair, and not use it for purposes other than agreed. Section 111 lists grounds for lease termination including efflux of time, breach of condition, forfeiture, and express surrender. Tenants are also protected by state-specific Rent Control Acts which may override these provisions — in many states, landlords cannot evict tenants except on specific grounds such as non-payment of rent, subletting, or bona fide personal need.""",
        "source_url": "https://legislative.gov.in/transfer-property-act-1882-lease",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "1882-07-01",
        "year": 1882,
    },
    {
        "document_type": "STATUTE",
        "title": "Maintenance and Welfare of Parents and Senior Citizens Act, 2007",
        "act_name": "Maintenance and Welfare of Parents and Senior Citizens Act, 2007",
        "section_number": "Sections 4-23",
        "body_text": """This Act protects the rights of parents and senior citizens (60+ years). Section 4 entitles parents and senior citizens who are unable to maintain themselves to claim maintenance from their children or legal heirs. "Children" includes sons, daughters, grandsons, and granddaughters — adopted children are included. Section 5 allows applications to the Maintenance Tribunal established under the Act. Section 9 sets the maximum maintenance at ₹10,000/month per parent (may vary by state). Section 16 states that if a senior citizen has transferred property to any person by gift or otherwise, and that person refuses to provide basic amenities, the transfer can be declared void. Section 19 mandates state governments to establish at least one old age home per district (capacity 150+). Section 21 punishes abandonment of a senior citizen with up to 3 months' imprisonment or ₹5,000 fine. The Act covers all citizens regardless of religion. Helpline: 14567 (Elder Helpline).""",
        "source_url": "https://legislative.gov.in/senior-citizens-act-2007",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2007-12-29",
        "year": 2007,
    },
    {
        "document_type": "STATUTE",
        "title": "Legal Services Authorities Act, 1987 — Free Legal Aid",
        "act_name": "Legal Services Authorities Act, 1987",
        "section_number": "Sections 12-13",
        "body_text": """The Legal Services Authorities Act, 1987 establishes a framework for providing free legal aid to weaker sections and organising Lok Adalats for amicable settlement of disputes. Section 12 specifies who is entitled to free legal aid: (a) SC/ST members, (b) victims of trafficking, (c) women and children, (d) persons with disabilities, (e) persons in custody, (f) industrial workmen, (g) victims of mass disasters/ethnic violence/caste atrocities/flood/drought/earthquake/industrial disasters, (h) any person whose annual income is below the prescribed limit (currently ₹3,00,000 for Supreme Court and ₹1,00,000 or as prescribed by state for other courts). Section 13 establishes the entitlement to legal services which includes representation by an advocate, payment of court fees, charges for obtaining certified copies, and all incidental expenses. NALSA (National Legal Services Authority) coordinates the system. Contact NALSA Helpline: 15100. Every district has a District Legal Services Authority (DLSA) that can be approached directly.""",
        "source_url": "https://legislative.gov.in/lsa-act-1987",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "1995-11-09",
        "year": 1987,
    },
    {
        "document_type": "STATUTE",
        "title": "Information Technology Act, 2000 — Cyber Crimes",
        "act_name": "Information Technology Act, 2000",
        "section_number": "Sections 43, 66-67, 72",
        "body_text": """The Information Technology Act, 2000 (amended 2008) is India's primary cyber law. Section 43 addresses penalties for unauthorized access, data theft, introducing viruses, or causing damage to computer systems — compensation up to ₹5 crore. Section 66 punishes computer-related offences (hacking) with up to 3 years imprisonment and fine. Section 66B punishes receiving stolen computer resources — up to 3 years. Section 66C punishes identity theft — up to 3 years and ₹1 lakh fine. Section 66D punishes cheating by impersonation using computer resources — up to 3 years. Section 66E punishes violation of privacy (capturing/publishing private images) — up to 3 years. Section 66F defines cyber terrorism — life imprisonment. Section 67 punishes publishing obscene material electronically — up to 3/5 years. Section 67A punishes sexually explicit material — up to 5/7 years. Section 67B addresses child pornography — up to 5/7 years. Section 72 punishes breach of confidentiality and privacy — up to 2 years. Report cyber crimes: Cyber Crime Helpline 1930 or cybercrime.gov.in.""",
        "source_url": "https://legislative.gov.in/it-act-2000",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2000-10-17",
        "year": 2000,
    },
    {
        "document_type": "STATUTE",
        "title": "Protection of Women from Domestic Violence Act, 2005",
        "act_name": "Protection of Women from Domestic Violence Act, 2005",
        "section_number": "Sections 3, 12, 17-23",
        "body_text": """The Protection of Women from Domestic Violence Act (PWDVA), 2005 protects women from domestic violence in shared households. Section 3 defines domestic violence broadly — physical abuse, sexual abuse, verbal and emotional abuse, and economic abuse. Economic abuse includes deprivation of financial resources, prohibition from accessing household resources, or disposal of shared assets. Section 12 allows an aggrieved woman to file a complaint with a Magistrate. Section 17 guarantees the right to reside in the shared household — a woman cannot be evicted. Section 18 provides protection orders. Section 19 provides residence orders — the Magistrate can restrain the respondent from entering the shared household. Section 20 provides monetary relief — including loss of earnings, medical expenses, maintenance. Section 21 provides custody orders for children. Section 22 provides compensation for injuries including mental torture. Section 23 allows ex-parte interim orders. The Act protects wives, live-in partners, mothers, sisters, and any woman in a domestic relationship. Women Helpline: 181 (toll-free, 24/7).""",
        "source_url": "https://legislative.gov.in/pwdva-2005",
        "source_name": "Legislative Department, Government of India",
        "effective_from": "2006-10-26",
        "year": 2005,
    },
]


async def seed():
    """Seed legal documents and generate embeddings."""
    print("🔄 Initializing embedding model...")
    embedder = EmbedderService()
    await embedder.load_models()

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_factory() as session:
        # Check if embeddings already exist
        emb_result = await session.execute(sa.text("SELECT COUNT(*) FROM document_embeddings WHERE embedding IS NOT NULL"))
        emb_count = emb_result.scalar()
        if emb_count and emb_count > 0:
            print(f"✅ Database already has {emb_count} embeddings. Skipping seed.")
            print("   To re-seed, run: DELETE FROM document_embeddings; DELETE FROM legal_documents;")
            await engine.dispose()
            return

        # Check for existing legal documents without embeddings
        doc_result = await session.execute(
            sa.text("SELECT id, title, body_text, section_number FROM legal_documents WHERE is_repealed = false")
        )
        existing_docs = doc_result.fetchall()

        if existing_docs:
            print(f"📚 Found {len(existing_docs)} existing documents without embeddings. Generating embeddings...")
            total_chunks = 0
            for i, row in enumerate(existing_docs):
                doc_id, title, body_text, section_number = str(row[0]), row[1], row[2], row[3]
                if not body_text:
                    print(f"  ⚠️  [{i+1}] {title[:60]} — no body_text, skipping")
                    continue
                chunks = _chunk_text(body_text.strip(), max_tokens=400, overlap=50)
                for chunk_idx, chunk_text_val in enumerate(chunks):
                    embedding = embedder.embed_query(chunk_text_val)
                    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                    emb_id = str(uuid.uuid4())
                    await session.execute(
                        sa.text("""
                            INSERT INTO document_embeddings
                                (id, document_id, chunk_index, chunk_text, chunk_tokens,
                                 embedding_model, embedding, search_vector, section_ref)
                            VALUES
                                (:id, :doc_id, :chunk_index, :chunk_text, :chunk_tokens,
                                 :model, CAST(:embedding AS vector(1024)),
                                 to_tsvector('english', :chunk_text), :section_ref)
                        """),
                        {
                            "id": emb_id,
                            "doc_id": doc_id,
                            "chunk_index": chunk_idx,
                            "chunk_text": chunk_text_val,
                            "chunk_tokens": len(chunk_text_val.split()),
                            "model": "intfloat/multilingual-e5-large",
                            "embedding": embedding_str,
                            "section_ref": section_number,
                        },
                    )
                total_chunks += len(chunks)
                print(f"  ✅ [{i+1}/{len(existing_docs)}] {title[:60]}... ({len(chunks)} chunks)")
            await session.commit()
            print(f"\n🎉 Generated embeddings for {len(existing_docs)} documents ({total_chunks} chunks)!")
            await engine.dispose()
            return

        # No existing docs — insert our sample corpus
        print(f"📚 Seeding {len(LEGAL_DOCUMENTS)} legal documents...")

        for i, doc in enumerate(LEGAL_DOCUMENTS):
            doc_id = str(uuid.uuid4())

            await session.execute(
                sa.text("""
                    INSERT INTO legal_documents
                        (id, document_type, title, act_name, section_number, body_text,
                         source_url, source_name, effective_from, year, is_repealed, updated_at)
                    VALUES
                        (:id, :document_type, :title, :act_name, :section_number, :body_text,
                         :source_url, :source_name, :effective_from, :year, false, NOW())
                """),
                {
                    "id": doc_id,
                    "document_type": doc["document_type"],
                    "title": doc["title"],
                    "act_name": doc["act_name"],
                    "section_number": doc.get("section_number"),
                    "body_text": doc["body_text"],
                    "source_url": doc["source_url"],
                    "source_name": doc["source_name"],
                    "effective_from": doc["effective_from"],
                    "year": doc["year"],
                },
            )

            text = doc["body_text"].strip()
            chunks = _chunk_text(text, max_tokens=400, overlap=50)

            for chunk_idx, chunk_text_val in enumerate(chunks):
                embedding = embedder.embed_query(chunk_text_val)
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                emb_id = str(uuid.uuid4())
                await session.execute(
                    sa.text("""
                        INSERT INTO document_embeddings
                            (id, document_id, chunk_index, chunk_text, chunk_tokens,
                             embedding_model, embedding, search_vector, section_ref)
                        VALUES
                            (:id, :doc_id, :chunk_index, :chunk_text, :chunk_tokens,
                             :model, CAST(:embedding AS vector(1024)),
                             to_tsvector('english', :chunk_text), :section_ref)
                    """),
                    {
                        "id": emb_id,
                        "doc_id": doc_id,
                        "chunk_index": chunk_idx,
                        "chunk_text": chunk_text_val,
                        "chunk_tokens": len(chunk_text_val.split()),
                        "model": "intfloat/multilingual-e5-large",
                        "embedding": embedding_str,
                        "section_ref": doc.get("section_number"),
                    },
                )

            print(f"  ✅ [{i+1}/{len(LEGAL_DOCUMENTS)}] {doc['title'][:60]}... ({len(chunks)} chunks)")

        await session.commit()
        print(f"\n🎉 Seeded {len(LEGAL_DOCUMENTS)} documents successfully!")

    await engine.dispose()


def _chunk_text(text: str, max_tokens: int = 400, overlap: int = 50) -> list[str]:
    """Simple sentence-based chunking."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current_chunk: list[str] = []
    current_len = 0

    for sentence in sentences:
        words = len(sentence.split())
        if current_len + words > max_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))
            # Keep last sentence for overlap
            overlap_sentences = current_chunk[-1:] if overlap > 0 else []
            current_chunk = overlap_sentences
            current_len = sum(len(s.split()) for s in current_chunk)
        current_chunk.append(sentence)
        current_len += words

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks if chunks else [text]


if __name__ == "__main__":
    asyncio.run(seed())
