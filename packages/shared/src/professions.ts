// ==============================================================================
// Comprehensive Indian Professions Dataset
// Organized by sector for searchable dropdown
// ==============================================================================

export interface ProfessionEntry {
  value: string;
  label: string;
  sector: string;
}

export const PROFESSION_SECTORS = [
  "Agriculture & Allied",
  "Armed Forces & Defence",
  "Arts & Entertainment",
  "Banking & Finance",
  "Construction & Real Estate",
  "Education & Research",
  "Engineering & Manufacturing",
  "Government & Public Sector",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Information Technology",
  "Legal & Judiciary",
  "Media & Communication",
  "Mining & Energy",
  "Retail & Commerce",
  "Social Work & NGO",
  "Sports & Fitness",
  "Textile & Garment",
  "Transport & Logistics",
  "Unorganized & Informal",
] as const;

export const PROFESSIONS: ProfessionEntry[] = [
  // Agriculture & Allied
  { value: "farmer", label: "Farmer / Kisan", sector: "Agriculture & Allied" },
  { value: "agricultural_labourer", label: "Agricultural Labourer", sector: "Agriculture & Allied" },
  { value: "dairy_farmer", label: "Dairy Farmer", sector: "Agriculture & Allied" },
  { value: "fisherman", label: "Fisherman / Fisher", sector: "Agriculture & Allied" },
  { value: "horticulturist", label: "Horticulturist", sector: "Agriculture & Allied" },
  { value: "poultry_farmer", label: "Poultry Farmer", sector: "Agriculture & Allied" },
  { value: "sericulturist", label: "Sericulturist", sector: "Agriculture & Allied" },
  { value: "veterinarian", label: "Veterinarian", sector: "Agriculture & Allied" },
  { value: "forestry_worker", label: "Forestry Worker", sector: "Agriculture & Allied" },
  { value: "plantation_worker", label: "Plantation Worker", sector: "Agriculture & Allied" },

  // Armed Forces & Defence
  { value: "army_officer", label: "Army Officer", sector: "Armed Forces & Defence" },
  { value: "navy_officer", label: "Navy Officer", sector: "Armed Forces & Defence" },
  { value: "air_force_officer", label: "Air Force Officer", sector: "Armed Forces & Defence" },
  { value: "soldier", label: "Soldier / Jawan", sector: "Armed Forces & Defence" },
  { value: "paramilitary", label: "Paramilitary Personnel (CRPF/BSF/CISF)", sector: "Armed Forces & Defence" },
  { value: "coast_guard", label: "Coast Guard", sector: "Armed Forces & Defence" },
  { value: "defence_civilian", label: "Defence Civilian Employee", sector: "Armed Forces & Defence" },

  // Arts & Entertainment
  { value: "actor", label: "Actor / Actress", sector: "Arts & Entertainment" },
  { value: "musician", label: "Musician", sector: "Arts & Entertainment" },
  { value: "dancer", label: "Dancer / Choreographer", sector: "Arts & Entertainment" },
  { value: "painter_artist", label: "Painter / Visual Artist", sector: "Arts & Entertainment" },
  { value: "sculptor", label: "Sculptor", sector: "Arts & Entertainment" },
  { value: "film_director", label: "Film Director", sector: "Arts & Entertainment" },
  { value: "writer_author", label: "Writer / Author", sector: "Arts & Entertainment" },
  { value: "photographer", label: "Photographer", sector: "Arts & Entertainment" },
  { value: "event_manager", label: "Event Manager", sector: "Arts & Entertainment" },

  // Banking & Finance
  { value: "bank_officer", label: "Bank Officer", sector: "Banking & Finance" },
  { value: "bank_clerk", label: "Bank Clerk", sector: "Banking & Finance" },
  { value: "insurance_agent", label: "Insurance Agent", sector: "Banking & Finance" },
  { value: "chartered_accountant", label: "Chartered Accountant (CA)", sector: "Banking & Finance" },
  { value: "company_secretary", label: "Company Secretary (CS)", sector: "Banking & Finance" },
  { value: "financial_analyst", label: "Financial Analyst", sector: "Banking & Finance" },
  { value: "tax_consultant", label: "Tax Consultant", sector: "Banking & Finance" },
  { value: "stock_broker", label: "Stock Broker", sector: "Banking & Finance" },
  { value: "microfinance_officer", label: "Microfinance Officer", sector: "Banking & Finance" },
  { value: "money_lender", label: "Money Lender", sector: "Banking & Finance" },

  // Construction & Real Estate
  { value: "civil_engineer", label: "Civil Engineer", sector: "Construction & Real Estate" },
  { value: "architect", label: "Architect", sector: "Construction & Real Estate" },
  { value: "construction_worker", label: "Construction Worker / Mason", sector: "Construction & Real Estate" },
  { value: "carpenter", label: "Carpenter", sector: "Construction & Real Estate" },
  { value: "plumber", label: "Plumber", sector: "Construction & Real Estate" },
  { value: "electrician", label: "Electrician", sector: "Construction & Real Estate" },
  { value: "painter_building", label: "Painter (Building)", sector: "Construction & Real Estate" },
  { value: "real_estate_agent", label: "Real Estate Agent", sector: "Construction & Real Estate" },
  { value: "interior_designer", label: "Interior Designer", sector: "Construction & Real Estate" },
  { value: "welder", label: "Welder", sector: "Construction & Real Estate" },

  // Education & Research
  { value: "school_teacher", label: "School Teacher", sector: "Education & Research" },
  { value: "college_professor", label: "College / University Professor", sector: "Education & Research" },
  { value: "private_tutor", label: "Private Tutor", sector: "Education & Research" },
  { value: "principal", label: "Principal / Head Master", sector: "Education & Research" },
  { value: "research_scientist", label: "Research Scientist", sector: "Education & Research" },
  { value: "librarian", label: "Librarian", sector: "Education & Research" },
  { value: "anganwadi_worker", label: "Anganwadi Worker", sector: "Education & Research" },
  { value: "coaching_instructor", label: "Coaching Centre Instructor", sector: "Education & Research" },

  // Engineering & Manufacturing
  { value: "mechanical_engineer", label: "Mechanical Engineer", sector: "Engineering & Manufacturing" },
  { value: "electrical_engineer", label: "Electrical Engineer", sector: "Engineering & Manufacturing" },
  { value: "chemical_engineer", label: "Chemical Engineer", sector: "Engineering & Manufacturing" },
  { value: "factory_worker", label: "Factory Worker", sector: "Engineering & Manufacturing" },
  { value: "machine_operator", label: "Machine Operator", sector: "Engineering & Manufacturing" },
  { value: "quality_inspector", label: "Quality Inspector", sector: "Engineering & Manufacturing" },
  { value: "production_manager", label: "Production Manager", sector: "Engineering & Manufacturing" },
  { value: "industrial_designer", label: "Industrial Designer", sector: "Engineering & Manufacturing" },

  // Government & Public Sector
  { value: "ias_officer", label: "IAS Officer", sector: "Government & Public Sector" },
  { value: "ips_officer", label: "IPS Officer", sector: "Government & Public Sector" },
  { value: "ifs_officer", label: "IFS Officer", sector: "Government & Public Sector" },
  { value: "state_civil_service", label: "State Civil Service Officer", sector: "Government & Public Sector" },
  { value: "police_constable", label: "Police Constable", sector: "Government & Public Sector" },
  { value: "sub_inspector", label: "Sub Inspector of Police", sector: "Government & Public Sector" },
  { value: "panchayat_member", label: "Panchayat Member / Sarpanch", sector: "Government & Public Sector" },
  { value: "municipal_worker", label: "Municipal Corporation Worker", sector: "Government & Public Sector" },
  { value: "postal_worker", label: "Postal Worker / Postman", sector: "Government & Public Sector" },
  { value: "railway_employee", label: "Railway Employee", sector: "Government & Public Sector" },
  { value: "govt_clerk", label: "Government Clerk", sector: "Government & Public Sector" },
  { value: "revenue_officer", label: "Revenue / Tehsildar", sector: "Government & Public Sector" },
  { value: "block_development_officer", label: "Block Development Officer", sector: "Government & Public Sector" },
  { value: "firefighter", label: "Firefighter", sector: "Government & Public Sector" },

  // Healthcare & Medical
  { value: "doctor_allopathy", label: "Doctor (MBBS / MD)", sector: "Healthcare & Medical" },
  { value: "doctor_ayurveda", label: "Doctor (BAMS / Ayurveda)", sector: "Healthcare & Medical" },
  { value: "doctor_homeopathy", label: "Doctor (BHMS / Homeopathy)", sector: "Healthcare & Medical" },
  { value: "doctor_unani", label: "Doctor (BUMS / Unani)", sector: "Healthcare & Medical" },
  { value: "doctor_siddha", label: "Doctor (Siddha)", sector: "Healthcare & Medical" },
  { value: "dentist", label: "Dentist (BDS)", sector: "Healthcare & Medical" },
  { value: "nurse", label: "Nurse", sector: "Healthcare & Medical" },
  { value: "pharmacist", label: "Pharmacist", sector: "Healthcare & Medical" },
  { value: "asha_worker", label: "ASHA Worker", sector: "Healthcare & Medical" },
  { value: "lab_technician", label: "Lab Technician", sector: "Healthcare & Medical" },
  { value: "physiotherapist", label: "Physiotherapist", sector: "Healthcare & Medical" },
  { value: "paramedic", label: "Paramedic / Ambulance Staff", sector: "Healthcare & Medical" },
  { value: "midwife", label: "Midwife / Dai", sector: "Healthcare & Medical" },
  { value: "psychologist", label: "Psychologist / Counsellor", sector: "Healthcare & Medical" },
  { value: "optometrist", label: "Optometrist", sector: "Healthcare & Medical" },

  // Hospitality & Tourism
  { value: "hotel_manager", label: "Hotel Manager", sector: "Hospitality & Tourism" },
  { value: "chef_cook", label: "Chef / Cook", sector: "Hospitality & Tourism" },
  { value: "waiter", label: "Waiter / Server", sector: "Hospitality & Tourism" },
  { value: "tour_guide", label: "Tour Guide", sector: "Hospitality & Tourism" },
  { value: "travel_agent", label: "Travel Agent", sector: "Hospitality & Tourism" },
  { value: "housekeeping", label: "Housekeeping Staff", sector: "Hospitality & Tourism" },

  // Information Technology
  { value: "software_engineer", label: "Software Engineer / Developer", sector: "Information Technology" },
  { value: "data_scientist", label: "Data Scientist", sector: "Information Technology" },
  { value: "system_administrator", label: "System Administrator", sector: "Information Technology" },
  { value: "cybersecurity_analyst", label: "Cybersecurity Analyst", sector: "Information Technology" },
  { value: "ui_ux_designer", label: "UI/UX Designer", sector: "Information Technology" },
  { value: "project_manager_it", label: "IT Project Manager", sector: "Information Technology" },
  { value: "database_admin", label: "Database Administrator", sector: "Information Technology" },
  { value: "network_engineer", label: "Network Engineer", sector: "Information Technology" },
  { value: "tech_support", label: "Technical Support / Help Desk", sector: "Information Technology" },
  { value: "bpo_employee", label: "BPO / Call Centre Employee", sector: "Information Technology" },

  // Legal & Judiciary
  { value: "advocate", label: "Advocate / Lawyer", sector: "Legal & Judiciary" },
  { value: "judge", label: "Judge", sector: "Legal & Judiciary" },
  { value: "public_prosecutor", label: "Public Prosecutor", sector: "Legal & Judiciary" },
  { value: "notary", label: "Notary Public", sector: "Legal & Judiciary" },
  { value: "legal_advisor", label: "Legal Advisor / Counsel", sector: "Legal & Judiciary" },
  { value: "court_clerk", label: "Court Clerk / Peshkar", sector: "Legal & Judiciary" },
  { value: "paralegal", label: "Paralegal", sector: "Legal & Judiciary" },
  { value: "law_intern", label: "Law Intern / Trainee", sector: "Legal & Judiciary" },

  // Media & Communication
  { value: "journalist", label: "Journalist / Reporter", sector: "Media & Communication" },
  { value: "news_anchor", label: "News Anchor", sector: "Media & Communication" },
  { value: "editor", label: "Editor", sector: "Media & Communication" },
  { value: "cameraman", label: "Cameraman / Videographer", sector: "Media & Communication" },
  { value: "public_relations", label: "Public Relations Officer", sector: "Media & Communication" },
  { value: "advertising", label: "Advertising Professional", sector: "Media & Communication" },
  { value: "social_media_manager", label: "Social Media Manager", sector: "Media & Communication" },
  { value: "translator_interpreter", label: "Translator / Interpreter", sector: "Media & Communication" },

  // Mining & Energy
  { value: "mining_engineer", label: "Mining Engineer", sector: "Mining & Energy" },
  { value: "mine_worker", label: "Mine Worker", sector: "Mining & Energy" },
  { value: "petroleum_engineer", label: "Petroleum Engineer", sector: "Mining & Energy" },
  { value: "power_plant_operator", label: "Power Plant Operator", sector: "Mining & Energy" },
  { value: "solar_technician", label: "Solar Panel Technician", sector: "Mining & Energy" },
  { value: "geologist", label: "Geologist", sector: "Mining & Energy" },

  // Retail & Commerce
  { value: "shopkeeper", label: "Shopkeeper / Retail Store Owner", sector: "Retail & Commerce" },
  { value: "street_vendor", label: "Street Vendor / Hawker", sector: "Retail & Commerce" },
  { value: "wholesale_dealer", label: "Wholesale Dealer", sector: "Retail & Commerce" },
  { value: "salesperson", label: "Salesperson", sector: "Retail & Commerce" },
  { value: "ecommerce_seller", label: "E-commerce Seller", sector: "Retail & Commerce" },
  { value: "market_trader", label: "Market Trader / Mandi Worker", sector: "Retail & Commerce" },
  { value: "jeweller", label: "Jeweller / Goldsmith", sector: "Retail & Commerce" },

  // Social Work & NGO
  { value: "social_worker", label: "Social Worker", sector: "Social Work & NGO" },
  { value: "ngo_worker", label: "NGO Worker", sector: "Social Work & NGO" },
  { value: "community_organizer", label: "Community Organizer", sector: "Social Work & NGO" },
  { value: "paralegal_volunteer", label: "Para-Legal Volunteer (PLV)", sector: "Social Work & NGO" },
  { value: "counsellor", label: "Counsellor", sector: "Social Work & NGO" },
  { value: "disability_worker", label: "Disability Rights Worker", sector: "Social Work & NGO" },

  // Sports & Fitness
  { value: "sportsperson", label: "Professional Sportsperson", sector: "Sports & Fitness" },
  { value: "coach_trainer", label: "Sports Coach / Trainer", sector: "Sports & Fitness" },
  { value: "gym_instructor", label: "Gym Instructor", sector: "Sports & Fitness" },
  { value: "yoga_instructor", label: "Yoga Instructor", sector: "Sports & Fitness" },
  { value: "referee_umpire", label: "Referee / Umpire", sector: "Sports & Fitness" },

  // Textile & Garment
  { value: "weaver", label: "Weaver / Handloom Worker", sector: "Textile & Garment" },
  { value: "tailor", label: "Tailor / Darzi", sector: "Textile & Garment" },
  { value: "fashion_designer", label: "Fashion Designer", sector: "Textile & Garment" },
  { value: "textile_worker", label: "Textile Mill Worker", sector: "Textile & Garment" },
  { value: "embroiderer", label: "Embroiderer / Zari Worker", sector: "Textile & Garment" },
  { value: "dyer", label: "Dyer", sector: "Textile & Garment" },

  // Transport & Logistics
  { value: "truck_driver", label: "Truck Driver", sector: "Transport & Logistics" },
  { value: "bus_driver", label: "Bus Driver", sector: "Transport & Logistics" },
  { value: "auto_rickshaw", label: "Auto Rickshaw Driver", sector: "Transport & Logistics" },
  { value: "taxi_driver", label: "Taxi / Cab Driver", sector: "Transport & Logistics" },
  { value: "delivery_agent", label: "Delivery Agent", sector: "Transport & Logistics" },
  { value: "pilot", label: "Pilot", sector: "Transport & Logistics" },
  { value: "sailor", label: "Sailor / Merchant Navy", sector: "Transport & Logistics" },
  { value: "logistics_manager", label: "Logistics / Supply Chain Manager", sector: "Transport & Logistics" },
  { value: "warehouse_worker", label: "Warehouse Worker", sector: "Transport & Logistics" },
  { value: "railway_driver", label: "Train Driver / Loco Pilot", sector: "Transport & Logistics" },

  // Unorganized & Informal
  { value: "domestic_worker", label: "Domestic Worker / House Help", sector: "Unorganized & Informal" },
  { value: "ragpicker", label: "Ragpicker / Waste Collector", sector: "Unorganized & Informal" },
  { value: "laundry_worker", label: "Laundry Worker / Dhobi", sector: "Unorganized & Informal" },
  { value: "barber", label: "Barber / Nai", sector: "Unorganized & Informal" },
  { value: "cobbler", label: "Cobbler / Mochi", sector: "Unorganized & Informal" },
  { value: "potter", label: "Potter / Kumhar", sector: "Unorganized & Informal" },
  { value: "blacksmith", label: "Blacksmith / Lohar", sector: "Unorganized & Informal" },
  { value: "daily_wage_labourer", label: "Daily Wage Labourer", sector: "Unorganized & Informal" },
  { value: "rickshaw_puller", label: "Rickshaw Puller", sector: "Unorganized & Informal" },
  { value: "beedi_worker", label: "Beedi Worker", sector: "Unorganized & Informal" },
  { value: "sex_worker", label: "Sex Worker", sector: "Unorganized & Informal" },
  { value: "safai_karmachari", label: "Safai Karmachari / Sanitation Worker", sector: "Unorganized & Informal" },
  { value: "priest_pujari", label: "Priest / Pujari / Religious Worker", sector: "Unorganized & Informal" },
  { value: "astrologer", label: "Astrologer / Jyotishi", sector: "Unorganized & Informal" },
  { value: "other", label: "Other", sector: "Unorganized & Informal" },
];
