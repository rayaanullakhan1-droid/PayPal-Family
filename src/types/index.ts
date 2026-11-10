export type UserRole = 'owner' | 'member';

export interface BankAccount {
  accountHolderName: string;
  bankName: string;
  accountNumber: string; // Masked representation: e.g. "•••• •••• 4821"
  rawAccountNumber?: string;
  ifscCode: string;
  linkedAt: string;
}

export type OnboardingStep =
  | 'mobile'
  | 'bank'
  | 'family_choice'
  | 'create_family'
  | 'join_family'
  | 'pending_approval'
  | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  relationship?: string; // e.g. "Family Head", "Daughter (Student)", "Son (Student)"
  familyId: string;
  mobile?: string;
  phone?: string;
  country?: string;
  countryCode?: string;
  bankAccount?: BankAccount;
  onboardingStep?: OnboardingStep;
  membershipStatus?: 'ACTIVE' | 'PENDING' | 'REJECTED';
  isCustomUser?: boolean;
  createdAt?: string;
  hasTransactionPin?: boolean;
  pinHash?: string;
  pinSalt?: string;
  pinSetAt?: string;
}

export interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  currency: 'INR';
  joiningCode?: string;
  initialBalancePaise?: number;
  isCustomFamily?: boolean;
  bankAccount?: BankAccount;
  fundingSource?: string;
}

export interface MembershipRequest {
  id: string;
  familyId: string;
  familyName: string;
  userId: string;
  userName: string;
  userMobile: string;
  userAvatar?: string;
  bankSummary?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  resolvedAt?: string;
  rejectionReason?: string;
}

export interface SpendingRule {
  memberId: string;
  singleTransactionLimitPaise: number; // e.g. 200,000 paise = ₹2,000 (Maximum Money Request Limit / Single Cap)
  maxRequestLimitPaise?: number;       // Explicit maximum money request limit in paise
  dailyLimitPaise: number;             // e.g. 500,000 paise = ₹5,000
  monthlyLimitPaise: number;           // e.g. 1,000,000 paise = ₹10,000
  allowMoneyTransfer: boolean;
  allowQRPayments: boolean;
}

export interface Wallet {
  userId: string;
  balancePaise: number;
  currency: 'INR';
  isSimulated: true;
}

export type PaymentSource = 'ADMIN_ACCOUNT' | 'PERSONAL_ACCOUNT';

export type TransactionType = 'TRANSFER' | 'QR_PAYMENT' | 'ADD_MONEY' | 'SPEND';
export type TransactionStatus = 'COMPLETED' | 'REJECTED' | 'PENDING';

export interface Transaction {
  id: string;
  reference: string;
  familyId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amountPaise: number;
  currency: 'INR';
  initiatorId: string; // Member who initiated or Owner who sent
  payerId: string;     // Administrator who funded the transfer/payment
  senderId?: string;   // Sender account ID
  senderName?: string; // Sender display name
  recipientId?: string; // Receiver member ID or merchant ID
  recipientName: string; // Receiver display name (Member or Merchant)
  paymentSource?: PaymentSource; // Payment source used
  merchantId?: string;
  merchantCategory?: string;
  date: string; // ISO 8601 string
  rejectionReason?: string;
  note?: string;
  isSimulated: true;
}

export interface MoneyRequest {
  id: string;
  familyId?: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  amountPaise: number;
  purpose: string;
  message?: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  createdAt: string;
  resolvedAt?: string;
  rejectionReason?: string;
  transactionReference?: string;
  // Limit Exception Request Metadata
  isException?: boolean;
  isExtraMoneyRequest?: boolean;
  configuredLimitPaise?: number;
  excessAmountPaise?: number;
}

export interface QRPayload {
  format: 'paypal_family_qr_v1';
  merchantId: string;
  merchantName: string;
  merchantCategory: string;
  amountPaise: number;
  currency: 'INR';
  invoiceId: string;
}

export interface DemoMerchant {
  id: string;
  name: string;
  category: string;
  defaultAmountPaise: number;
  description: string;
  iconName: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  metadata?: {
    type?: string;
    data?: any;
    suggestedQueries?: string[];
    providerName?: string;
  };
}

