// ==============================================================================
// PocketJury API — Database Seed Script
// ==============================================================================

import { PrismaClient, DocumentType, HelplineCategory, IPCBNSMappingType, EscalationAuthorityType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PocketJury database...\n");

  // ----- 1. Supported Languages -----
  console.log("  → Languages...");
  const languages = [
    { code: "en", nameEnglish: "English", nameNative: "English", script: "Latin", isActive: true },
    { code: "hi", nameEnglish: "Hindi", nameNative: "हिन्दी", script: "Devanagari", isActive: true },
    { code: "ta", nameEnglish: "Tamil", nameNative: "தமிழ்", script: "Tamil", isActive: true },
    { code: "bn", nameEnglish: "Bengali", nameNative: "বাংলা", script: "Bengali", isActive: true },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: { nameEnglish: lang.nameEnglish, nameNative: lang.nameNative, script: lang.script, isActive: lang.isActive },
      create: lang,
    });
  }

  // ----- 2. National Helplines -----
  console.log("  → Helplines...");
  const helplines = [
    { name: "National Legal Services Authority (NALSA)", number: "15100", description: "Free legal aid and advice for eligible citizens under the Legal Services Authorities Act, 1987.", category: HelplineCategory.LEGAL_AID, isNational: true },
    { name: "Women Helpline", number: "181", description: "24/7 helpline for women in distress — domestic violence, harassment, dowry, sexual assault, trafficking.", category: HelplineCategory.WOMEN, isNational: true },
    { name: "Police Emergency", number: "112", description: "Unified emergency number for police, fire, and ambulance across India.", category: HelplineCategory.EMERGENCY, isNational: true },
    { name: "Police (Direct)", number: "100", description: "Direct police helpline for reporting crimes and emergencies.", category: HelplineCategory.EMERGENCY, isNational: true },
    { name: "Childline India", number: "1098", description: "24/7 free helpline for children in need of care and protection. Covers abuse, child labour, trafficking.", category: HelplineCategory.CHILD, isNational: true },
    { name: "Senior Citizen Helpline", number: "14567", description: "Helpline providing assistance to senior citizens — elder abuse, pension, medical aid, legal support.", category: HelplineCategory.SENIOR, isNational: true },
    { name: "Cyber Crime Helpline", number: "1930", description: "National helpline for reporting cyber crimes including online fraud, identity theft, and cyber bullying.", category: HelplineCategory.CYBERCRIME, isNational: true },
    { name: "Consumer Helpline", number: "14566", description: "National Consumer Helpline for grievances related to defective products, deficient services, and unfair trade practices.", category: HelplineCategory.LEGAL_AID, isNational: true },
    { name: "Department of Justice Helpline", number: "1800-419-8588", description: "Toll-free helpline run by the Department of Justice for legal aid queries, court procedure guidance, and pro bono assistance.", category: HelplineCategory.LEGAL_AID, isNational: true },
    { name: "Vandrevala Foundation", number: "1860-2662-345", description: "24/7 mental health and crisis intervention helpline.", category: HelplineCategory.EMERGENCY, isNational: true },
    { name: "Anti Ragging Helpline", number: "1800-180-5522", description: "Toll-free helpline to report ragging incidents in educational institutions.", category: HelplineCategory.CHILD, isNational: true },
    { name: "National Commission for Women", number: "7827-170-170", description: "WhatsApp number for complaints regarding women's rights violations.", category: HelplineCategory.WOMEN, isNational: true },
    { name: "Railway Police (RPF)", number: "182", description: "Helpline for reporting crimes on railway premises and trains.", category: HelplineCategory.EMERGENCY, isNational: true },
  ];

  for (const h of helplines) {
    await prisma.helpline.upsert({
      where: { number: h.number },
      update: { name: h.name, description: h.description, category: h.category, isNational: h.isNational },
      create: h,
    });
  }

  // ----- 3. IPC–BNS Mappings -----
  console.log("  → IPC–BNS Mappings...");
  const ipcBnsMappings = [
    { ipcSection: "299", bnsSection: "106", description: "Culpable Homicide — renumbered; substantive content retained.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "300", bnsSection: "103", description: "Murder — renumbered; punishment unchanged (death/life/10yr + fine).", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "302", bnsSection: "103(1)", description: "Punishment for Murder — merged with definition.", mappingType: IPCBNSMappingType.MERGED },
    { ipcSection: "304", bnsSection: "106(1)", description: "Punishment for Culpable Homicide not amounting to Murder — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "304A", bnsSection: "106(2)", description: "Causing death by negligence — added sub-section for rash/negligent driving causing death.", mappingType: IPCBNSMappingType.SPLIT },
    { ipcSection: "304B", bnsSection: "80", description: "Dowry Death — renumbered; substantive change — no bail before charge sheet.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "306", bnsSection: "108", description: "Abetment of Suicide — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "307", bnsSection: "109", description: "Attempt to Murder — renumbered; punishment unchanged.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "312", bnsSection: "88", description: "Causing Miscarriage — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "323", bnsSection: "115(2)", description: "Punishment for voluntarily causing hurt — renumbered; graded penalties.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "326", bnsSection: "118(2)", description: "Voluntarily causing grievous hurt by dangerous weapons — merged sub-sections.", mappingType: IPCBNSMappingType.MERGED },
    { ipcSection: "354", bnsSection: "74", description: "Assault on woman with intent to outrage modesty — renumbered; minimum increased to 1 year.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "354A", bnsSection: "75", description: "Sexual Harassment — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "354D", bnsSection: "78", description: "Stalking — renumbered; added cyber stalking explicitly.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "375", bnsSection: "63", description: "Rape — renumbered; definition largely unchanged.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "376", bnsSection: "64", description: "Punishment for Rape — renumbered; minimum 10 years.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "376(3)", bnsSection: "65(2)", description: "Rape of minor under 16 — minimum 20 years imprisonment.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "377", bnsSection: "-", description: "Unnatural Offences — struck down by SC in Navtej Singh Johar (2018). Not carried forward in BNS.", mappingType: IPCBNSMappingType.DROPPED },
    { ipcSection: "378", bnsSection: "303", description: "Theft — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "379", bnsSection: "303(2)", description: "Punishment for Theft — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "383", bnsSection: "308", description: "Extortion — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "392", bnsSection: "309(4)", description: "Punishment for Robbery — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "395", bnsSection: "310(2)", description: "Punishment for Dacoity — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "405", bnsSection: "316", description: "Criminal Breach of Trust — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "415", bnsSection: "318", description: "Cheating — renumbered; definition unchanged.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "420", bnsSection: "318(4)", description: "Cheating and dishonestly inducing delivery of property — renumbered; enhanced penalties.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "463", bnsSection: "336", description: "Forgery — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "497", bnsSection: "-", description: "Adultery — struck down by SC in Joseph Shine v Union of India (2018). Not carried forward.", mappingType: IPCBNSMappingType.DROPPED },
    { ipcSection: "498A", bnsSection: "85", description: "Cruelty by husband or relatives — renumbered; definition retained.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "499", bnsSection: "356", description: "Defamation — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "500", bnsSection: "356(2)", description: "Punishment for Defamation — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "503", bnsSection: "351", description: "Criminal Intimidation — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "506", bnsSection: "351(2)", description: "Punishment for Criminal Intimidation — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    { ipcSection: "509", bnsSection: "79", description: "Word, gesture or act intended to insult the modesty of a woman — renumbered.", mappingType: IPCBNSMappingType.DIRECT },
    // New BNS sections (no IPC equivalent)
    { ipcSection: "-", bnsSection: "69", description: "Sexual intercourse by employing deceitful means — NEW BNS section.", mappingType: IPCBNSMappingType.NEW },
    { ipcSection: "-", bnsSection: "111", description: "Organised Crime — NEW BNS section.", mappingType: IPCBNSMappingType.NEW },
    { ipcSection: "-", bnsSection: "112", description: "Petty Organised Crime — NEW BNS section.", mappingType: IPCBNSMappingType.NEW },
    { ipcSection: "-", bnsSection: "113", description: "Terrorist Act — NEW BNS section.", mappingType: IPCBNSMappingType.NEW },
    { ipcSection: "-", bnsSection: "152", description: "Acts endangering sovereignty, unity and integrity of India — NEW BNS section (replaces sedition).", mappingType: IPCBNSMappingType.NEW },
  ];

  for (const m of ipcBnsMappings) {
    await prisma.iPCBNSMapping.upsert({
      where: {
        ipcSection_bnsSection: {
          ipcSection: m.ipcSection,
          bnsSection: m.bnsSection,
        },
      },
      update: { description: m.description, mappingType: m.mappingType },
      create: m,
    });
  }

  // ----- 4. Sample DLSA Escalation Contacts -----
  console.log("  → Sample DLSA contacts...");
  const dlsaContacts = [
    { state: "Delhi", district: "Central", authorityName: "Delhi Legal Services Authority", authorityType: EscalationAuthorityType.DLSA, phone: "011-23384781", email: "dlsa-central-dl@nic.in", address: "Patiala House Courts, New Delhi - 110001", latitude: 28.6229, longitude: 77.2358, isActive: true },
    { state: "Delhi", district: "New Delhi", authorityName: "DLSA New Delhi", authorityType: EscalationAuthorityType.DLSA, phone: "011-23074147", email: "dlsa-newdelhi-dl@nic.in", address: "Patiala House Courts Complex, New Delhi", latitude: 28.6240, longitude: 77.2340, isActive: true },
    { state: "Delhi", district: "South", authorityName: "DLSA South Delhi", authorityType: EscalationAuthorityType.DLSA, phone: "011-26102091", email: "dlsa-south-dl@nic.in", address: "Saket Courts Complex, New Delhi - 110017", latitude: 28.5222, longitude: 77.2067, isActive: true },
    { state: "Maharashtra", district: "Mumbai City", authorityName: "DLSA Mumbai City", authorityType: EscalationAuthorityType.DLSA, phone: "022-22620460", email: "dlsa-mumbaicity@mah.nic.in", address: "High Court Building, Fort, Mumbai - 400032", latitude: 18.9281, longitude: 72.8318, isActive: true },
    { state: "Maharashtra", district: "Mumbai Suburban", authorityName: "DLSA Mumbai Suburban", authorityType: EscalationAuthorityType.DLSA, phone: "022-26430088", email: "dlsa-mumbaisuburban@mah.nic.in", address: "Dindoshi Court, Goregaon, Mumbai - 400065", latitude: 19.1568, longitude: 72.8485, isActive: true },
    { state: "Maharashtra", district: "Pune", authorityName: "DLSA Pune", authorityType: EscalationAuthorityType.DLSA, phone: "020-26123456", email: "dlsa-pune@mah.nic.in", address: "Pune District Court, Shivajinagar, Pune - 411005", latitude: 18.5307, longitude: 73.8467, isActive: true },
    { state: "Tamil Nadu", district: "Chennai", authorityName: "DLSA Chennai", authorityType: EscalationAuthorityType.DLSA, phone: "044-25340745", email: "dlsa-chennai@tn.nic.in", address: "High Court Campus, Chennai - 600104", latitude: 13.0827, longitude: 80.2707, isActive: true },
    { state: "Tamil Nadu", district: "Coimbatore", authorityName: "DLSA Coimbatore", authorityType: EscalationAuthorityType.DLSA, phone: "0422-2300456", email: "dlsa-coimbatore@tn.nic.in", address: "District Court, Coimbatore - 641018", latitude: 11.0168, longitude: 76.9558, isActive: true },
    { state: "Karnataka", district: "Bengaluru Urban", authorityName: "DLSA Bengaluru Urban", authorityType: EscalationAuthorityType.DLSA, phone: "080-22961562", email: "dlsa-blr@kar.nic.in", address: "District Courts Complex, Bengaluru - 560009", latitude: 12.9716, longitude: 77.5946, isActive: true },
    { state: "West Bengal", district: "Kolkata", authorityName: "DLSA Kolkata", authorityType: EscalationAuthorityType.DLSA, phone: "033-22486171", email: "dlsa-kolkata@wb.nic.in", address: "City Civil Court, Kolkata - 700001", latitude: 22.5726, longitude: 88.3639, isActive: true },
    { state: "Uttar Pradesh", district: "Lucknow", authorityName: "DLSA Lucknow", authorityType: EscalationAuthorityType.DLSA, phone: "0522-2288897", email: "dlsa-lucknow@up.nic.in", address: "District Court Complex, Lucknow - 226001", latitude: 26.8467, longitude: 80.9462, isActive: true },
    { state: "Rajasthan", district: "Jaipur", authorityName: "DLSA Jaipur Metropolitan", authorityType: EscalationAuthorityType.DLSA, phone: "0141-2227481", email: "dlsa-jaipur@raj.nic.in", address: "District Court, Jaipur - 302001", latitude: 26.9124, longitude: 75.7873, isActive: true },
    { state: "Gujarat", district: "Ahmedabad", authorityName: "DLSA Ahmedabad City", authorityType: EscalationAuthorityType.DLSA, phone: "079-25507722", email: "dlsa-ahmedabad@guj.nic.in", address: "City Civil Court, Ahmedabad - 380001", latitude: 23.0225, longitude: 72.5714, isActive: true },
    { state: "Telangana", district: "Hyderabad", authorityName: "DLSA Hyderabad", authorityType: EscalationAuthorityType.DLSA, phone: "040-24512916", email: "dlsa-hyderabad@telangana.nic.in", address: "District Courts Complex, Hyderabad - 500002", latitude: 17.3850, longitude: 78.4867, isActive: true },
    { state: "Kerala", district: "Ernakulam", authorityName: "DLSA Ernakulam", authorityType: EscalationAuthorityType.DLSA, phone: "0484-2394367", email: "dlsa-ernakulam@ker.nic.in", address: "District Court, Ernakulam - 682031", latitude: 9.9816, longitude: 76.2999, isActive: true },
    { state: "Madhya Pradesh", district: "Bhopal", authorityName: "DLSA Bhopal", authorityType: EscalationAuthorityType.DLSA, phone: "0755-2540123", email: "dlsa-bhopal@mp.nic.in", address: "District Court, Bhopal - 462001", latitude: 23.2599, longitude: 77.4126, isActive: true },
  ];

  for (const d of dlsaContacts) {
    await prisma.escalationContact.upsert({
      where: {
        state_district: { state: d.state, district: d.district },
      },
      update: { authorityName: d.authorityName, authorityType: d.authorityType, phone: d.phone, email: d.email, address: d.address, latitude: d.latitude, longitude: d.longitude, isActive: d.isActive },
      create: d,
    });
  }

  // ----- 5. Sample Legal Documents (metadata only — embeddings are separate) -----
  console.log("  → Sample legal document metadata...");
  const sampleDocs = [
    { title: "Indian Penal Code, 1860", documentType: DocumentType.STATUTE, actName: "Indian Penal Code", bodyText: "The Indian Penal Code (IPC) was the primary criminal code of India, repealed and replaced by the Bharatiya Nyaya Sanhita on 1 July 2024.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2263", sourceName: "India Code", effectiveFrom: new Date("1860-10-06"), year: 1860, isRepealed: true, metadata: { replacedBy: "Bharatiya Nyaya Sanhita, 2023", effectiveUntil: "2024-07-01" } },
    { title: "Bharatiya Nyaya Sanhita, 2023", documentType: DocumentType.STATUTE, actName: "Bharatiya Nyaya Sanhita", bodyText: "The Bharatiya Nyaya Sanhita (BNS) is the primary criminal code of India effective from 1 July 2024, replacing the Indian Penal Code, 1860.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20280", sourceName: "India Code", effectiveFrom: new Date("2024-07-01"), year: 2023, metadata: { replaces: "Indian Penal Code, 1860" } },
    { title: "Code of Criminal Procedure, 1973", documentType: DocumentType.STATUTE, actName: "Code of Criminal Procedure", bodyText: "The Code of Criminal Procedure (CrPC) governed the procedure for administration of substantive criminal law in India.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1611", sourceName: "India Code", effectiveFrom: new Date("1974-04-01"), year: 1973, isRepealed: true, metadata: { replacedBy: "Bharatiya Nagarik Suraksha Sanhita, 2023" } },
    { title: "Bharatiya Nagarik Suraksha Sanhita, 2023", documentType: DocumentType.STATUTE, actName: "Bharatiya Nagarik Suraksha Sanhita", bodyText: "The Bharatiya Nagarik Suraksha Sanhita (BNSS) is the procedural criminal code of India effective from 1 July 2024.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20281", sourceName: "India Code", effectiveFrom: new Date("2024-07-01"), year: 2023, metadata: { replaces: "Code of Criminal Procedure, 1973" } },
    { title: "Indian Evidence Act, 1872", documentType: DocumentType.STATUTE, actName: "Indian Evidence Act", bodyText: "The Indian Evidence Act governed the law of evidence in India until replaced by the Bharatiya Sakshya Adhiniyam.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2188", sourceName: "India Code", effectiveFrom: new Date("1872-09-01"), year: 1872, isRepealed: true, metadata: { replacedBy: "Bharatiya Sakshya Adhiniyam, 2023" } },
    { title: "Bharatiya Sakshya Adhiniyam, 2023", documentType: DocumentType.STATUTE, actName: "Bharatiya Sakshya Adhiniyam", bodyText: "The Bharatiya Sakshya Adhiniyam (BSA) is the law of evidence in India effective from 1 July 2024.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20282", sourceName: "India Code", effectiveFrom: new Date("2024-07-01"), year: 2023, metadata: { replaces: "Indian Evidence Act, 1872" } },
    { title: "Constitution of India", documentType: DocumentType.CONSTITUTION, actName: "Constitution of India", bodyText: "The Constitution of India is the supreme law of India, adopted on 26 November 1949 and came into effect on 26 January 1950.", sourceUrl: "https://www.india.gov.in/my-government/constitution-india", sourceName: "Government of India", effectiveFrom: new Date("1950-01-26"), year: 1950, metadata: { type: "Supreme law" } },
    { title: "Protection of Women from Domestic Violence Act, 2005", documentType: DocumentType.STATUTE, actName: "Protection of Women from Domestic Violence Act", bodyText: "An Act to provide for more effective protection of the rights of women guaranteed under the Constitution who are victims of violence.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2021", sourceName: "India Code", effectiveFrom: new Date("2006-10-26"), year: 2005, metadata: {} },
    { title: "Right to Information Act, 2005", documentType: DocumentType.STATUTE, actName: "Right to Information Act", bodyText: "An Act to provide for setting out the practical regime of right to information for citizens.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1993", sourceName: "India Code", effectiveFrom: new Date("2005-10-12"), year: 2005, metadata: {} },
    { title: "Consumer Protection Act, 2019", documentType: DocumentType.STATUTE, actName: "Consumer Protection Act", bodyText: "An Act to provide for protection of the interests of consumers and for the establishment of Consumer Disputes Redressal Commissions.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256", sourceName: "India Code", effectiveFrom: new Date("2020-07-20"), year: 2019, metadata: { replaces: "Consumer Protection Act, 1986" } },
    { title: "Digital Personal Data Protection Act, 2023", documentType: DocumentType.STATUTE, actName: "Digital Personal Data Protection Act", bodyText: "An Act to provide for the processing of digital personal data in a manner that recognises both the right to protect personal data and the need to process such data.", sourceUrl: "https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf", sourceName: "MeitY", effectiveFrom: new Date("2023-08-11"), year: 2023, metadata: {} },
    { title: "Information Technology Act, 2000", documentType: DocumentType.STATUTE, actName: "Information Technology Act", bodyText: "An Act to provide legal recognition for transactions carried out by means of electronic data interchange and other means of electronic communication.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1999", sourceName: "India Code", effectiveFrom: new Date("2000-10-17"), year: 2000, metadata: {} },
    { title: "Motor Vehicles Act, 1988", documentType: DocumentType.STATUTE, actName: "Motor Vehicles Act", bodyText: "An Act to consolidate and amend the law relating to motor vehicles.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1798", sourceName: "India Code", effectiveFrom: new Date("1989-07-01"), year: 1988, metadata: {} },
    { title: "Hindu Marriage Act, 1955", documentType: DocumentType.STATUTE, actName: "Hindu Marriage Act", bodyText: "An Act to amend and codify the law relating to marriage among Hindus.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1560", sourceName: "India Code", effectiveFrom: new Date("1955-05-18"), year: 1955, metadata: {} },
    { title: "Special Marriage Act, 1954", documentType: DocumentType.STATUTE, actName: "Special Marriage Act", bodyText: "An Act to provide a special form of marriage in certain cases, for the registration of such and certain other marriages.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1387", sourceName: "India Code", effectiveFrom: new Date("1954-10-09"), year: 1954, metadata: {} },
    { title: "Negotiable Instruments Act, 1881", documentType: DocumentType.STATUTE, actName: "Negotiable Instruments Act", bodyText: "An Act to define and amend the law relating to promissory notes, bills of exchange and cheques.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2191", sourceName: "India Code", effectiveFrom: new Date("1882-03-01"), year: 1881, metadata: {} },
    { title: "Legal Services Authorities Act, 1987", documentType: DocumentType.STATUTE, actName: "Legal Services Authorities Act", bodyText: "An Act to constitute legal services authorities to provide free and competent legal services to weaker sections of the society.", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/1508", sourceName: "India Code", effectiveFrom: new Date("1987-10-11"), year: 1987, metadata: {} },
  ];

  for (const doc of sampleDocs) {
    await prisma.legalDocument.upsert({
      where: { sourceUrl: doc.sourceUrl },
      update: { title: doc.title, documentType: doc.documentType, bodyText: doc.bodyText, metadata: doc.metadata },
      create: doc,
    });
  }

  console.log("\n✅ Seed completed successfully.");
  console.log(`   Languages:   ${languages.length}`);
  console.log(`   Helplines:   ${helplines.length}`);
  console.log(`   IPC-BNS:     ${ipcBnsMappings.length}`);
  console.log(`   DLSA:        ${dlsaContacts.length}`);
  console.log(`   Legal Docs:  ${sampleDocs.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
