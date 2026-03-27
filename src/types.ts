export type AgentRole = 'Research' | 'Email' | 'Scheduler' | 'Custom';

export interface Agent {
  id?: string;
  name: string;
  role: AgentRole;
  instructions: string;
  memory?: string;
  fullAccess?: boolean;
  userId: string;
  createdAt: any;
}

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  priority: 'low' | 'medium' | 'high' | 'critical';
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: any;
  updatedAt: any;
  dependencies?: string[]; // IDs of other tasks
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | 'broadcast';
  content: string;
  data?: any;
  type: 'request' | 'response' | 'info' | 'error';
  timestamp: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  type?: 'text' | 'action' | 'screenshot' | 'thought';
  screenshot?: string;
  action?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: any;
  status: 'success' | 'warning' | 'error' | 'info';
}
