// ==============================================================================
// PocketJury Shared Types
// ==============================================================================

// ---- Enums ----

export enum AuthProvider {
  EMAIL = "EMAIL",
  GOOGLE = "GOOGLE",
}

export enum UserRole {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

export enum PersonaMode {
  STUDENT = "STUDENT",
  PROFESSIONAL = "PROFESSIONAL",
  SENIOR_CITIZEN = "SENIOR_CITIZEN",
  RURAL_USER = "RURAL_USER",
  GENERAL = "GENERAL",
}

export enum ProfessionType {
  STUDENT = "STUDENT",
  EMPLOYED = "EMPLOYED",
  UNEMPLOYED = "UNEMPLOYED",
  SELF_EMPLOYED = "SELF_EMPLOYED",
}

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
  SYSTEM = "SYSTEM",
}

export enum DocumentType {
  STATUTE = "STATUTE",
  JUDGMENT = "JUDGMENT",
  CONSTITUTION = "CONSTITUTION",
  AMENDMENT = "AMENDMENT",
  NOTIFICATION = "NOTIFICATION",
  RULE = "RULE",
}

export enum ConsentType {
  DATA_PROCESSING = "DATA_PROCESSING",
  LOCATION = "LOCATION",
  ANALYTICS = "ANALYTICS",
  COMMUNICATION = "COMMUNICATION",
}

export enum EscalationAuthorityType {
  DLSA = "DLSA",
  SLSA = "SLSA",
  NALSA = "NALSA",
  HELPLINE = "HELPLINE",
}

export enum HelplineCategory {
  WOMEN = "WOMEN",
  CHILD = "CHILD",
  EMERGENCY = "EMERGENCY",
  LEGAL_AID = "LEGAL_AID",
  CYBERCRIME = "CYBERCRIME",
  SENIOR = "SENIOR",
  SC_ST = "SC_ST",
  TRAFFICKING = "TRAFFICKING",
}

export enum FeedbackRating {
  HELPFUL = "HELPFUL",
  NOT_HELPFUL = "NOT_HELPFUL",
}

export enum IPCBNSMappingType {
  DIRECT = "DIRECT",
  MERGED = "MERGED",
  SPLIT = "SPLIT",
  NEW = "NEW",
  DROPPED = "DROPPED",
}

export enum TextDirection {
  LTR = "LTR",
  RTL = "RTL",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

// ---- User & Profile Types ----

export interface User {
  id: string;
  email: string;
  authProvider: AuthProvider;
  googleId: string | null;
  preferredLanguage: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: Date;
  contactPhone: string | null;
  professionType: ProfessionType | null;
  fieldOfStudy: string | null;
  yearOfPassing: number | null;
  currentProfession: string | null;
  personaMode: PersonaMode;
  locationState: string | null;
  locationDistrict: string | null;
  profileCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Chat Types ----

export interface Chat {
  id: string;
  userId: string;
  title: string;
  personaMode: PersonaMode;
  languageCode: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  contentOriginalLanguage: string | null;
  languageCode: string;
  metadata: MessageMetadata | null;
  simplifiedContent: string | null;
  isFlagged: boolean;
  createdAt: Date;
}

export interface MessageMetadata {
  citedSections: CitedSection[];
  retrievalScores: number[];
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  helplines?: HelplineInfo[];
}

export interface CitedSection {
  actName: string;
  sectionNumber: string;
  title: string;
  effectiveFrom: string;
  sourceUrl?: string;
}

export interface HelplineInfo {
  name: string;
  number: string;
  category: HelplineCategory;
}

// ---- Legal Document Types ----

export interface LegalDocument {
  id: string;
  documentType: DocumentType;
  title: string;
  actName: string | null;
  sectionNumber: string | null;
  chapter: string | null;
  part: string | null;
  bodyText: string;
  sourceUrl: string;
  sourceName: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isRepealed: boolean;
  replacedById: string | null;
  year: number;
  amendmentNumber: string | null;
}

// ---- API Request/Response Types ----

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  contactPhone?: string;
  preferredLanguage: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  idToken: string;
}

export interface AuthResponse {
  user: Omit<User, "email"> & { email: string };
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileRequest {
  email?: string;
  dateOfBirth?: string;
  fullName?: string;
  contactPhone?: string;
  professionType?: ProfessionType;
  fieldOfStudy?: string;
  yearOfPassing?: number;
  currentProfession?: string;
  locationState?: string;
  locationDistrict?: string;
}

export interface CreateChatRequest {
  personaMode?: PersonaMode;
  languageCode?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface ChatQueryRequest {
  query: string;
  userId: string;
  chatId: string;
  personaMode: PersonaMode;
  languageCode: string;
  chatHistory: Array<{ role: string; content: string }>;
}

export interface ChatQueryResponse {
  response: string;
  citedSections: CitedSection[];
  language: string;
  helplines: HelplineInfo[];
  disclaimer: string;
  metadata: {
    retrievalScores: number[];
    tokensUsed: { input: number; output: number };
    latencyMs: number;
  };
}

export interface SimplifyRequest {
  originalResponse: string;
  languageCode: string;
  personaMode: PersonaMode;
}

export interface FeedbackRequest {
  messageId: string;
  rating: FeedbackRating;
  comment?: string;
}

export interface DLSASearchParams {
  state?: string;
  district?: string;
  lat?: number;
  lng?: number;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// ---- Language Types ----

export interface Language {
  code: string;
  nameEnglish: string;
  nameNative: string;
  script: string;
  isActive: boolean;
  direction: TextDirection;
}

// ---- Escalation Types ----

export interface EscalationContact {
  id: string;
  state: string;
  district: string;
  authorityName: string;
  authorityType: EscalationAuthorityType;
  address: string;
  phone: string;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

// ---- SSE Stream Types ----

export interface SSEEvent {
  event: "token" | "metadata" | "error" | "done";
  data: string;
}
