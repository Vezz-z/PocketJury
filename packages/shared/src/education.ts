// ==============================================================================
// Comprehensive Indian Education / Field of Study Dataset
// ==============================================================================

export interface EducationEntry {
  value: string;
  label: string;
  category: string;
}

export const EDUCATION_CATEGORIES = [
  "No Formal Education",
  "School Level",
  "Diploma & Certificate",
  "Undergraduate - Arts & Humanities",
  "Undergraduate - Science",
  "Undergraduate - Commerce & Management",
  "Undergraduate - Engineering & Technology",
  "Undergraduate - Medical & Health",
  "Undergraduate - Law",
  "Undergraduate - Education",
  "Undergraduate - Agriculture",
  "Undergraduate - Design & Architecture",
  "Postgraduate - Arts & Humanities",
  "Postgraduate - Science",
  "Postgraduate - Commerce & Management",
  "Postgraduate - Engineering & Technology",
  "Postgraduate - Medical & Health",
  "Postgraduate - Law",
  "Doctoral & Research",
  "Professional Certification",
  "Vocational & Skill Training",
] as const;

export const EDUCATION_FIELDS: EducationEntry[] = [
  // No Formal Education
  { value: "no_education", label: "No Formal Education", category: "No Formal Education" },
  { value: "literate_no_schooling", label: "Literate (No Formal Schooling)", category: "No Formal Education" },

  // School Level
  { value: "primary", label: "Primary (Class 1-5)", category: "School Level" },
  { value: "upper_primary", label: "Upper Primary (Class 6-8)", category: "School Level" },
  { value: "ssc_10th", label: "SSC / 10th Standard / Matriculation", category: "School Level" },
  { value: "hsc_12th", label: "HSC / 12th Standard / Intermediate", category: "School Level" },
  { value: "hsc_science", label: "HSC - Science Stream", category: "School Level" },
  { value: "hsc_commerce", label: "HSC - Commerce Stream", category: "School Level" },
  { value: "hsc_arts", label: "HSC - Arts / Humanities Stream", category: "School Level" },
  { value: "cbse_10", label: "CBSE 10th", category: "School Level" },
  { value: "cbse_12", label: "CBSE 12th", category: "School Level" },
  { value: "icse_10", label: "ICSE 10th", category: "School Level" },
  { value: "isc_12", label: "ISC 12th", category: "School Level" },
  { value: "nios", label: "NIOS (National Institute of Open Schooling)", category: "School Level" },

  // Diploma & Certificate
  { value: "iti", label: "ITI (Industrial Training Institute)", category: "Diploma & Certificate" },
  { value: "polytechnic_diploma", label: "Polytechnic Diploma", category: "Diploma & Certificate" },
  { value: "diploma_engineering", label: "Diploma in Engineering", category: "Diploma & Certificate" },
  { value: "diploma_nursing", label: "Diploma in Nursing (GNM)", category: "Diploma & Certificate" },
  { value: "diploma_pharmacy", label: "Diploma in Pharmacy (D.Pharm)", category: "Diploma & Certificate" },
  { value: "diploma_education", label: "Diploma in Education (D.Ed)", category: "Diploma & Certificate" },
  { value: "diploma_hotel_mgmt", label: "Diploma in Hotel Management", category: "Diploma & Certificate" },
  { value: "anm", label: "ANM (Auxiliary Nurse Midwifery)", category: "Diploma & Certificate" },
  { value: "certificate_computer", label: "Certificate in Computer Applications", category: "Diploma & Certificate" },

  // UG - Arts & Humanities
  { value: "ba", label: "BA (Bachelor of Arts)", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_english", label: "BA English", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_hindi", label: "BA Hindi", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_history", label: "BA History", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_political_science", label: "BA Political Science", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_economics", label: "BA Economics", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_sociology", label: "BA Sociology", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_psychology", label: "BA Psychology", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_philosophy", label: "BA Philosophy", category: "Undergraduate - Arts & Humanities" },
  { value: "ba_journalism", label: "BA Journalism & Mass Communication", category: "Undergraduate - Arts & Humanities" },
  { value: "bfa", label: "BFA (Bachelor of Fine Arts)", category: "Undergraduate - Arts & Humanities" },
  { value: "bsw", label: "BSW (Bachelor of Social Work)", category: "Undergraduate - Arts & Humanities" },

  // UG - Science
  { value: "bsc", label: "BSc (Bachelor of Science)", category: "Undergraduate - Science" },
  { value: "bsc_physics", label: "BSc Physics", category: "Undergraduate - Science" },
  { value: "bsc_chemistry", label: "BSc Chemistry", category: "Undergraduate - Science" },
  { value: "bsc_mathematics", label: "BSc Mathematics", category: "Undergraduate - Science" },
  { value: "bsc_biology", label: "BSc Biology / Life Sciences", category: "Undergraduate - Science" },
  { value: "bsc_computer_science", label: "BSc Computer Science", category: "Undergraduate - Science" },
  { value: "bsc_it", label: "BSc Information Technology", category: "Undergraduate - Science" },
  { value: "bsc_agriculture", label: "BSc Agriculture", category: "Undergraduate - Science" },
  { value: "bsc_biotechnology", label: "BSc Biotechnology", category: "Undergraduate - Science" },
  { value: "bsc_nursing", label: "BSc Nursing", category: "Undergraduate - Science" },
  { value: "bca", label: "BCA (Bachelor of Computer Applications)", category: "Undergraduate - Science" },
  { value: "bsc_statistics", label: "BSc Statistics", category: "Undergraduate - Science" },
  { value: "bsc_environmental", label: "BSc Environmental Science", category: "Undergraduate - Science" },

  // UG - Commerce & Management
  { value: "bcom", label: "BCom (Bachelor of Commerce)", category: "Undergraduate - Commerce & Management" },
  { value: "bcom_hons", label: "BCom (Honours)", category: "Undergraduate - Commerce & Management" },
  { value: "bba", label: "BBA (Bachelor of Business Administration)", category: "Undergraduate - Commerce & Management" },
  { value: "bbm", label: "BBM (Bachelor of Business Management)", category: "Undergraduate - Commerce & Management" },
  { value: "bcom_accounting", label: "BCom Accounting & Finance", category: "Undergraduate - Commerce & Management" },

  // UG - Engineering & Technology
  { value: "btech", label: "B.Tech (Bachelor of Technology)", category: "Undergraduate - Engineering & Technology" },
  { value: "be", label: "BE (Bachelor of Engineering)", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_cse", label: "B.Tech Computer Science & Engineering", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_ece", label: "B.Tech Electronics & Communication", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_eee", label: "B.Tech Electrical & Electronics", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_mech", label: "B.Tech Mechanical Engineering", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_civil", label: "B.Tech Civil Engineering", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_it", label: "B.Tech Information Technology", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_chemical", label: "B.Tech Chemical Engineering", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_biotech", label: "B.Tech Biotechnology", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_ai_ml", label: "B.Tech AI & Machine Learning", category: "Undergraduate - Engineering & Technology" },
  { value: "btech_data_science", label: "B.Tech Data Science", category: "Undergraduate - Engineering & Technology" },

  // UG - Medical & Health
  { value: "mbbs", label: "MBBS (Bachelor of Medicine & Surgery)", category: "Undergraduate - Medical & Health" },
  { value: "bds", label: "BDS (Bachelor of Dental Surgery)", category: "Undergraduate - Medical & Health" },
  { value: "bams", label: "BAMS (Ayurveda)", category: "Undergraduate - Medical & Health" },
  { value: "bhms", label: "BHMS (Homeopathy)", category: "Undergraduate - Medical & Health" },
  { value: "bums", label: "BUMS (Unani Medicine)", category: "Undergraduate - Medical & Health" },
  { value: "bpt", label: "BPT (Physiotherapy)", category: "Undergraduate - Medical & Health" },
  { value: "b_pharmacy", label: "B.Pharm (Pharmacy)", category: "Undergraduate - Medical & Health" },
  { value: "bvsc", label: "BVSc (Veterinary Science)", category: "Undergraduate - Medical & Health" },
  { value: "bot", label: "BOT (Occupational Therapy)", category: "Undergraduate - Medical & Health" },
  { value: "bmlt", label: "BMLT (Lab Technology)", category: "Undergraduate - Medical & Health" },

  // UG - Law
  { value: "ba_llb", label: "BA LLB (5 year integrated)", category: "Undergraduate - Law" },
  { value: "bba_llb", label: "BBA LLB (5 year integrated)", category: "Undergraduate - Law" },
  { value: "bcom_llb", label: "BCom LLB (5 year integrated)", category: "Undergraduate - Law" },
  { value: "bsc_llb", label: "BSc LLB (5 year integrated)", category: "Undergraduate - Law" },
  { value: "llb", label: "LLB (3 year)", category: "Undergraduate - Law" },

  // UG - Education
  { value: "bed", label: "B.Ed (Bachelor of Education)", category: "Undergraduate - Education" },
  { value: "bped", label: "BPEd (Physical Education)", category: "Undergraduate - Education" },
  { value: "beled", label: "B.El.Ed (Elementary Education)", category: "Undergraduate - Education" },

  // UG - Agriculture
  { value: "bsc_agriculture_ug", label: "BSc (Hons) Agriculture", category: "Undergraduate - Agriculture" },
  { value: "bsc_horticulture", label: "BSc Horticulture", category: "Undergraduate - Agriculture" },
  { value: "bsc_forestry", label: "BSc Forestry", category: "Undergraduate - Agriculture" },
  { value: "b_fisheries", label: "BFSc (Bachelor of Fisheries Science)", category: "Undergraduate - Agriculture" },

  // UG - Design & Architecture
  { value: "b_arch", label: "B.Arch (Architecture)", category: "Undergraduate - Design & Architecture" },
  { value: "b_des", label: "B.Des (Bachelor of Design)", category: "Undergraduate - Design & Architecture" },
  { value: "b_planning", label: "B.Planning (Urban Planning)", category: "Undergraduate - Design & Architecture" },

  // PG - Arts & Humanities
  { value: "ma", label: "MA (Master of Arts)", category: "Postgraduate - Arts & Humanities" },
  { value: "msw", label: "MSW (Master of Social Work)", category: "Postgraduate - Arts & Humanities" },
  { value: "mfa", label: "MFA (Master of Fine Arts)", category: "Postgraduate - Arts & Humanities" },
  { value: "mjmc", label: "MJMC (Journalism & Mass Communication)", category: "Postgraduate - Arts & Humanities" },

  // PG - Science
  { value: "msc", label: "MSc (Master of Science)", category: "Postgraduate - Science" },
  { value: "mca", label: "MCA (Master of Computer Applications)", category: "Postgraduate - Science" },
  { value: "msc_data_science", label: "MSc Data Science", category: "Postgraduate - Science" },

  // PG - Commerce & Management
  { value: "mba", label: "MBA (Master of Business Administration)", category: "Postgraduate - Commerce & Management" },
  { value: "mcom", label: "MCom (Master of Commerce)", category: "Postgraduate - Commerce & Management" },
  { value: "pgdm", label: "PGDM (Post Graduate Diploma in Management)", category: "Postgraduate - Commerce & Management" },

  // PG - Engineering & Technology
  { value: "mtech", label: "M.Tech (Master of Technology)", category: "Postgraduate - Engineering & Technology" },
  { value: "me", label: "ME (Master of Engineering)", category: "Postgraduate - Engineering & Technology" },

  // PG - Medical & Health
  { value: "md", label: "MD (Doctor of Medicine)", category: "Postgraduate - Medical & Health" },
  { value: "ms_surgery", label: "MS (Master of Surgery)", category: "Postgraduate - Medical & Health" },
  { value: "m_pharmacy", label: "M.Pharm (Master of Pharmacy)", category: "Postgraduate - Medical & Health" },
  { value: "mph", label: "MPH (Master of Public Health)", category: "Postgraduate - Medical & Health" },

  // PG - Law
  { value: "llm", label: "LLM (Master of Laws)", category: "Postgraduate - Law" },

  // Doctoral & Research
  { value: "phd", label: "PhD (Doctor of Philosophy)", category: "Doctoral & Research" },
  { value: "dsc", label: "DSc (Doctor of Science)", category: "Doctoral & Research" },
  { value: "dlit", label: "DLitt (Doctor of Literature)", category: "Doctoral & Research" },
  { value: "dm", label: "DM (Doctorate of Medicine - Super Specialty)", category: "Doctoral & Research" },
  { value: "mch", label: "MCh (Master of Chirurgiae - Super Specialty)", category: "Doctoral & Research" },
  { value: "post_doc", label: "Post-Doctoral Research", category: "Doctoral & Research" },

  // Professional Certification
  { value: "ca", label: "CA (Chartered Accountant)", category: "Professional Certification" },
  { value: "cs", label: "CS (Company Secretary)", category: "Professional Certification" },
  { value: "cma", label: "CMA (Cost & Management Accountant)", category: "Professional Certification" },
  { value: "cfa", label: "CFA (Chartered Financial Analyst)", category: "Professional Certification" },

  // Vocational & Skill Training
  { value: "nsqf", label: "NSQF Certified Training", category: "Vocational & Skill Training" },
  { value: "pmkvy", label: "PMKVY (Pradhan Mantri Kaushal Vikas Yojana)", category: "Vocational & Skill Training" },
  { value: "skill_india", label: "Skill India Certification", category: "Vocational & Skill Training" },
  { value: "apprenticeship", label: "Apprenticeship Training", category: "Vocational & Skill Training" },
  { value: "other_education", label: "Other", category: "Vocational & Skill Training" },
];
