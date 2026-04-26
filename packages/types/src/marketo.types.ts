export interface MarketoLeadInput {
  email: string;
  firstName: string;
  company?: string;
  title?: string;
  LeadSource: string;
  Use_Case__c?: string;
  Intent_Level__c?: string;
  Current_Solution__c?: string;
}

export interface MarketoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface MarketoApiResponse {
  requestId: string;
  success: boolean;
  result?: MarketoLeadResult[];
  errors?: MarketoApiError[];
}

export interface MarketoLeadResult {
  id: number;
  status: "created" | "updated" | "skipped";
}

export interface MarketoApiError {
  code: string;
  message: string;
}
