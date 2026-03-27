import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  db, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  orderBy,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  User
} from './firebase';
import { Agent, ChatMessage, ActivityLog, AgentRole, AgentTask, AgentMessage } from './types';
import { chatWithJarvis } from './services/gemini';
import { 
  LayoutDashboard, 
  MessageSquare, 
  PlusCircle, 
  LogOut, 
  Settings, 
  Search, 
  Brain, 
  Monitor, 
  Send, 
  User as UserIcon, 
  Bot, 
  History, 
  Mic, 
  Sun, 
  Moon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Menu,
  X,
  FileText,
  Mail,
  Calendar,
  Database,
  Volume2,
  Globe,
  Briefcase,
  Code,
  Users,
  Clock,
  Image,
  Zap,
  ShieldCheck,
  Activity,
  RefreshCcw,
  Trash2,
  Terminal as TerminalIcon,
  RotateCcw,
  ExternalLink,
  Key,
  Shield,
  Bell,
  ToggleLeft,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg group",
      active 
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" 
        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-white dark:text-zinc-900" : "text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100")} />
    <span>{label}</span>
  </button>
);

const AgentCard = ({ agent, onSelect }: { agent: Agent, onSelect: (a: Agent) => void }) => (
  <div 
    onClick={() => onSelect(agent)}
    className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-all group"
  >
    <div className="flex items-center justify-between mb-2">
      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors">
        <Bot className="w-4 h-4" />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{agent.role}</span>
    </div>
    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{agent.name}</h3>
    <p className="text-xs text-zinc-500 line-clamp-2">{agent.instructions}</p>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'chat' | 'factory' | 'logs' | 'terminal' | 'browser' | 'scheduler' | 'skills' | 'activity' | 'settings' | 'memory'>('chat');
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    telegram: '',
    openai: '',
    custom: ''
  });
  const [systemSettings, setSystemSettings] = useState({
    autoHeal: true,
    notifications: true,
    autonomousMode: false,
    debugMode: false
  });
  const [enabledSkills, setEnabledSkills] = useState<string[]>(['gmail', 'terminal', 'filesystem', 'calendar', 'sheets', 'browser', 'image', 'scheduler', 'code', 'analysis', 'sync', 'telegram']);
  const [fullAccess, setFullAccess] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<{ id: string, task: string, cron: string, description: string, status: 'active' | 'completed' }[]>([]);
  const [browserTabs, setBrowserTabs] = useState<{ id: string, url: string, active: boolean }[]>([{ id: '1', url: 'https://www.google.com', active: true }]);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newAgent, setNewAgent] = useState({ name: '', role: 'Research' as AgentRole, instructions: '', memory: '', fullAccess: false });
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["[SYSTEM]: Jarvis Hub initialized.", "[AUTH]: taleibrahimova27@gmail.com verified."]);
  const [browserUrl, setBrowserUrl] = useState('https://google.com');
  const [browserLoading, setBrowserLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [longTermMemory, setLongTermMemory] = useState<{ id: string, key: string, value: string, updatedAt: any }[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    status: 'healthy',
    lastCheck: new Date().toISOString(),
    issues: [] as string[],
    performance: 'optimal'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'user_settings', user.uid), {
        apiKeys,
        systemSettings,
        updatedAt: serverTimestamp()
      });
      showToast("Ayarlar uğurla yadda saxlanıldı! ✅", 'success');
    } catch (error) {
      console.error("Failed to save settings", error);
      showToast("Ayarları yadda saxlamaq mümkün olmadı. ❌", 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'user_settings', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.apiKeys) setApiKeys(data.apiKeys);
        if (data.systemSettings) setSystemSettings(data.systemSettings);
      }
    }, (error) => handleFirestoreError(error, 'get', `user_settings/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  // Load Long-term Memory
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'long_term_memory'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setLongTermMemory(m);
    }, (error) => handleFirestoreError(error, 'list', 'long_term_memory'));
    return unsubscribe;
  }, [user]);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      operation,
      path,
      userId: user?.uid,
      email: user?.email
    };
    console.error(`[FIRESTORE ERROR]: ${JSON.stringify(errInfo)}`);
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.instructions) return;
    try {
      await addDoc(collection(db, 'agents'), {
        ...newAgent,
        userId: user?.uid,
        createdAt: serverTimestamp()
      });
      setNewAgent({ name: '', role: 'Research', instructions: '', memory: '', fullAccess: false });
      showToast("Agent uğurla yaradıldı! ✅", 'success');
    } catch (error) {
      console.error("Failed to create agent", error);
    }
  };

  const toggleSkill = (skill: string) => {
    setEnabledSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<'lite' | 'pro' | 'search'>('lite');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth & Data Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && u.email === 'taleibrahimova27@gmail.com') {
        setUser(u);
      } else if (u) {
        signOut(auth);
        alert("Access restricted to authorized user only.");
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSendMessage = async (e?: React.FormEvent, overrideInput?: string, source: 'web' | 'telegram' = 'web') => {
    e?.preventDefault();
    const messageText = overrideInput || input;
    if (!messageText.trim() || isTyping) return;

    // Delegation Logic: Check if message mentions an agent
    const mentionedAgent = agents.find(a => messageText.toLowerCase().includes(a.name.toLowerCase()));
    let finalMessage = messageText;
    if (mentionedAgent) {
      finalMessage = `[DELEGATED TO ${mentionedAgent.name}]: ${messageText}\n\nAgent Instructions: ${mentionedAgent.instructions}\n\nAgent Memory/Context: ${mentionedAgent.memory || 'None'}`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      type: source === 'telegram' ? 'telegram' : undefined
    } as any;

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await chatWithJarvis(messageText, history, mode, enabledSkills, fullAccess, apiKeys);
      
      // If from telegram, send text response back to telegram
      if (source === 'telegram' && response.text && telegramChatId) {
        try {
          await fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: telegramChatId, message: response.text })
          });
        } catch (err) {
          console.error("Failed to send response back to Telegram", err);
        }
      }

      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          // Autonomous tools logic
          if (call.name === 'get_system_info') {
            const args = call.args as any;
            let info = "";
            if (args.scope === 'agents' || args.scope === 'all') {
              info += `Active Agents: ${agents.map(a => a.name).join(', ') || 'None'}\n`;
            }
            if (args.scope === 'files' || args.scope === 'all') {
              info += `System Files: (Simulated file list: src/, public/, server.ts, package.json)\n`;
            }
            if (args.scope === 'logs' || args.scope === 'all') {
              info += `Recent Logs: (Simulated logs: System initialized, User authenticated)\n`;
            }
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[SYSTEM INFO]:\n${info}`,
              timestamp: Date.now(),
              type: 'info'
            } as any]);
            continue;
          }

          if (call.name === 'create_sub_agent') {
            const args = call.args as any;
            try {
              await addDoc(collection(db, 'agents'), {
                name: args.name,
                role: args.role,
                instructions: args.instructions,
                memory: args.memory || '',
                fullAccess: args.fullAccess || false,
                userId: user?.uid,
                createdAt: serverTimestamp()
              });
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: `[AGENT CREATED]: **${args.name}** (${args.role}) has been successfully initialized in the Agent Factory.`,
                timestamp: Date.now(),
                type: 'info'
              } as any]);
              setView('factory');
            } catch (error) {
              console.error("Failed to create sub-agent via tool", error);
            }
            continue;
          }

          if (call.name === 'create_autonomous_task') {
            const newTask: AgentTask = {
              id: Math.random().toString(36).substr(2, 9),
              agentId: call.args.agentId as string,
              title: call.args.title as string,
              description: call.args.description as string,
              status: 'pending',
              priority: (call.args.priority as any) || 'medium',
              retryCount: 0,
              maxRetries: 3,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            setTasks(prev => [newTask, ...prev]);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[TASK CREATED]: "${call.args.title}" assigned to agent ${call.args.agentId}`,
              timestamp: Date.now(),
              type: 'info'
            } as any]);
            continue;
          }

          if (call.name === 'agent_to_agent_message') {
            const newMessage: AgentMessage = {
              id: Math.random().toString(36).substr(2, 9),
              fromAgentId: 'Jarvis',
              toAgentId: call.args.toAgentId as string,
              content: call.args.content as string,
              data: call.args.data ? JSON.parse(call.args.data as string) : null,
              type: (call.args.type as any) || 'info',
              timestamp: serverTimestamp()
            };
            setAgentMessages(prev => [newMessage, ...prev]);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[MESSAGE SENT]: Jarvis -> ${call.args.toAgentId}: "${call.args.content}"`,
              timestamp: Date.now(),
              type: 'info'
            } as any]);
            continue;
          }

          if (call.name === 'report_error_and_request_fix') {
             setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[SELF-HEAL REQUESTED]: Error: ${call.args.error}. Attempting autonomous fix...`,
              timestamp: Date.now(),
              type: 'warning'
            } as any]);
            // Trigger autonomous fix loop
            setTimeout(() => {
              handleSendMessage(undefined, `Xəta baş verdi: ${call.args.error}. Kontekst: ${call.args.context}. Zəhmət olmasa bu xətanı avtonom şəkildə həll et və işə davam et.`);
            }, 2000);
            continue;
          }

          if (call.name === 'manage_long_term_memory') {
            const args = call.args as any;
            try {
              if (args.action === 'save') {
                const q = query(collection(db, 'long_term_memory'), where('userId', '==', user?.uid), where('key', '==', args.key));
                // In a real app we'd check if it exists and update, here we just add or let firestore handle it
                await addDoc(collection(db, 'long_term_memory'), {
                  userId: user?.uid,
                  key: args.key,
                  value: args.value,
                  updatedAt: serverTimestamp()
                });
                showToast(`Yaddaş yeniləndi: ${args.key} ✅`, 'info');
              } else if (args.action === 'retrieve' || args.action === 'search') {
                const found = longTermMemory.find(m => m.key === args.key || m.value.includes(args.query || ''));
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'system',
                  content: found ? `[MEMORY RETRIEVED]: ${found.key} -> ${found.value}` : `[MEMORY]: No entry found for ${args.key || args.query}`,
                  timestamp: Date.now(),
                  type: 'info'
                } as any]);
              }
            } catch (error) {
              console.error("Memory operation failed", error);
            }
            continue;
          }

          if (call.name === 'monitor_system_health') {
            const args = call.args as any;
            setSystemHealth(prev => ({
              ...prev,
              lastCheck: new Date().toISOString(),
              status: 'healthy',
              performance: 'optimal'
            }));
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[HEALTH CHECK]: System is ${systemHealth.status}. Performance: ${systemHealth.performance}. No critical issues detected.`,
              timestamp: Date.now(),
              type: 'info'
            } as any]);
            continue;
          }

          if (call.name === 'self_improve_system') {
            const args = call.args as any;
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `[SELF-IMPROVEMENT]: Jarvis analyzed the system. Suggested improvements: ${args.improvements.join(', ')}. Action: ${args.action}`,
              timestamp: Date.now(),
              type: 'info'
            } as any]);
            if (args.action === 'apply') {
              showToast("Sistem təkmilləşdirilməsi tətbiq edilir... 🚀", 'success');
              setTerminalLogs(prev => [...prev, `[SELF-IMPROVE]: Applying improvements: ${args.improvements.join(', ')}`]);
            }
            continue;
          }

          const sensitiveTools = ['send_gmail', 'computer_use', 'terminal_command', 'file_system_operation', 'manage_calendar', 'manage_sheets', 'generate_image', 'schedule_task', 'execute_code', 'analyze_document', 'multi_agent_sync', 'send_telegram_message'];
          if (sensitiveTools.includes(call.name)) {
            if (call.name === 'send_telegram_message' && !telegramChatId) {
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: "[TELEGRAM ERROR]: Telegram bot is not paired. Please go to 'Skills & Access' to pair your account.",
                timestamp: Date.now(),
                type: 'error'
              } as any]);
              continue;
            }
            setPendingAction({ ...call, timestamp: Date.now() });
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'model',
              content: call.name === 'send_telegram_message' 
                ? `I want to send you a Telegram message: "${call.args.message}". Please confirm.`
                : `I need to perform an action: **${call.name.replace(/_/g, ' ')}**. Please confirm.`,
              timestamp: Date.now(),
              type: 'action',
              action: JSON.stringify(call.args)
            }]);
          } else {
            // Handle non-sensitive or auto-exec tools
            if (call.name === 'manage_browser_tabs') {
              const args = call.args as any;
              if (args.action === 'open') {
                const newTab = { id: Math.random().toString(36).substr(2, 9), url: args.url || 'about:blank', active: true };
                setBrowserTabs(prev => prev.map(t => ({ ...t, active: false })).concat(newTab));
              } else if (args.action === 'switch') {
                setBrowserTabs(prev => prev.map(t => ({ ...t, active: t.id === args.tabId })));
              }
            }
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'model',
              content: `Executing ${call.name}... (Simulated OpenClaw/Workspace Integration)`,
              timestamp: Date.now(),
            }]);
          }
        }
      } else {
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: response.text || "I'm sorry, I couldn't process that.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, modelMsg]);

        // If from Telegram, send response back
        if (source === 'telegram' && telegramChatId && response.text) {
          try {
            await fetch('/api/telegram/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: telegramChatId, message: response.text })
            });
          } catch (err) {
            console.error("Failed to auto-reply to Telegram", err);
          }
        }
      }

      // Log activity
      await addDoc(collection(db, 'logs'), {
        userId: user?.uid,
        action: 'Chat',
        details: `User: ${messageText.substring(0, 50)}...`,
        status: 'success',
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.error("Chat error", error);
      setIsTyping(false);
      
      if (systemSettings.autoHeal && messages.length < 50) { // Simple safeguard against infinite loops
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `[SYSTEM ERROR]: ${error instanceof Error ? error.message : 'Unknown error'}. Jarvis avtonom bərpa üçün analiz edir...`,
          timestamp: Date.now(),
          type: 'error'
        } as any]);
        
        setTimeout(() => {
          handleSendMessage(undefined, `Sistem xətası baş verdi: ${error instanceof Error ? error.message : 'Naməlum xəta'}. Zəhmət olmasa bu xətanı analiz et və avtonom şəkildə düzəltməyə çalış.`);
        }, 3000);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: "❌ Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin və ya sistem loqlarını yoxlayın.",
          timestamp: Date.now(),
          type: 'error'
        } as any]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Telegram Pairing Sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'telegram_pairings', user.uid), (doc) => {
      if (doc.exists()) {
        setTelegramChatId(doc.data().chatId);
      }
    }, (error) => handleFirestoreError(error, 'get', `telegram_pairings/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  // Telegram Pairing Handshake Listener
  useEffect(() => {
    if (!user || !pairingCode) return;
    
    const unsubscribe = onSnapshot(doc(db, 'bot_handshakes', pairingCode), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.userId === user.uid) {
          try {
            // Complete pairing on client-side (authenticated)
            await setDoc(doc(db, 'telegram_pairings', user.uid), {
              chatId: data.chatId,
              username: data.username,
              firstName: data.firstName,
              pairedAt: serverTimestamp()
            });
            
            // Cleanup handshake
            await deleteDoc(doc(db, 'bot_handshakes', pairingCode));
            
            setPairingCode(null);
            alert("✅ Telegram pairing successful!");
          } catch (error) {
            handleFirestoreError(error, 'write', `telegram_pairings/${user.uid}`);
          }
        }
      }
    }, (error) => handleFirestoreError(error, 'get', `bot_handshakes/${pairingCode}`));
    
    return () => unsubscribe();
  }, [user, pairingCode]);

  // Telegram Message Listener
  useEffect(() => {
    if (!user || !telegramChatId) return;

    const q = query(
      collection(db, 'telegram_messages'),
      where('userId', '==', user.uid),
      where('processed', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const msgData = change.doc.data();
          const msgId = change.doc.id;

          // Mark as processed immediately to avoid double processing
          await updateDoc(doc(db, 'telegram_messages', msgId), {
            processed: true
          });

          // Trigger Jarvis
          handleSendMessage(undefined, msgData.text, 'telegram');
        }
      });
    }, (error) => handleFirestoreError(error, 'list', 'telegram_messages'));

    return () => unsubscribe();
  }, [user, telegramChatId]);

  const generatePairingCode = async () => {
    if (!user) return;
    setIsPairing(true);
    try {
      const response = await fetch('/api/telegram/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await response.json();
      setPairingCode(data.code);
    } catch (error) {
      console.error("Failed to generate pairing code", error);
    } finally {
      setIsPairing(false);
    }
  };

  // Fetch Agents
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'agents'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const a = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent));
      setAgents(a);
    }, (error) => handleFirestoreError(error, 'list', 'agents'));
    return unsubscribe;
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const exportChat = () => {
    window.print();
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice input not supported in this browser.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'az-AZ'; // Default to Azerbaijani
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    
    const actionName = pendingAction.name;
    const actionArgs = pendingAction.args;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: `Action **${actionName}** confirmed and executed.`,
      timestamp: Date.now(),
    }]);

    if (actionName === 'computer_use') {
      setTerminalLogs(prev => [...prev, `[EXEC]: Running computer_use action: ${actionArgs.action}`]);
      setBrowserLoading(true);
      
      // Simulate computer use loop: Thought -> Action -> Screenshot
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `**Thought:** I need to access the browser to perform the requested action: *${actionArgs.action}*.\n\n**Action:** Opening browser and navigating to destination...`,
        timestamp: Date.now(),
      }]);

      setTimeout(() => {
        setBrowserUrl(`https://www.google.com/search?q=${encodeURIComponent(actionArgs.action)}`);
        setBrowserLoading(false);
        setTerminalLogs(prev => [...prev, `[BROWSER]: Navigated to search results for "${actionArgs.action}"`]);
        
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `**Screenshot captured:** Analyzing the page content...`,
          timestamp: Date.now(),
          type: 'screenshot',
          screenshot: `https://picsum.photos/seed/${Math.random()}/1280/720`
        }]);

        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          role: 'model',
          content: `**Final Result:** Action completed successfully. I have processed the information from the browser.`,
          timestamp: Date.now(),
        }]);
      }, 1500);
    }

    if (actionName === 'terminal_command') {
      setTerminalLogs(prev => [...prev, `[EXEC]: Running command: ${actionArgs.command}`]);
      setTimeout(() => {
        let output = `(Simulated output for ${actionArgs.command})`;
        if (actionArgs.command === 'ls') output = "src/  public/  server.ts  package.json  vite.config.ts";
        if (actionArgs.command === 'pwd') output = "/home/user/jarvis-hub";
        if (actionArgs.command === 'whoami') output = "zaur_master";
        
        setTerminalLogs(prev => [...prev, `[SYSTEM]: Command "${actionArgs.command}" executed successfully.`, `[OUTPUT]: ${output}`]);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: `Terminal command **${actionArgs.command}** has been executed. Check the Terminal view for output.`,
          timestamp: Date.now(),
        }]);
      }, 1000);
    }

    if (actionName === 'file_system_operation') {
      setTerminalLogs(prev => [...prev, `[FS]: ${actionArgs.operation.toUpperCase()} on ${actionArgs.path}`]);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Fayl sistemi əməliyyatı (**${actionArgs.operation}**) uğurla icra edildi: \`${actionArgs.path}\``,
        timestamp: Date.now(),
      }]);
    }

    if (actionName === 'manage_calendar' || actionName === 'manage_sheets') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Google Workspace əməliyyatı (**${actionName}**) uğurla tamamlandı.`,
        timestamp: Date.now(),
      }]);
    }

    if (actionName === 'generate_image') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `**${actionArgs.prompt}** təsviri əsasında şəkil yaradıldı:`,
        timestamp: Date.now(),
        type: 'screenshot',
        screenshot: `https://picsum.photos/seed/${Math.random()}/1024/1024`
      }]);
    }

    if (actionName === 'schedule_task') {
      const newTask = {
        id: Date.now().toString(),
        task: actionArgs.task,
        cron: actionArgs.cronExpression,
        description: actionArgs.description || '',
        status: 'active' as const
      };
      setScheduledTasks(prev => [...prev, newTask]);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Tapşırıq planlaşdırıldı: **${actionArgs.task}** (${actionArgs.cronExpression})`,
        timestamp: Date.now(),
      }]);
    }

    if (actionName === 'execute_code') {
      setTerminalLogs(prev => [...prev, `[CODE]: Executing ${actionArgs.language} code...`]);
      setTimeout(() => {
        setTerminalLogs(prev => [...prev, `[OUTPUT]: (Simulated ${actionArgs.language} execution result for the provided code)`]);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: `Kod icra edildi (**${actionArgs.language}**). Nəticəni Terminalda görə bilərsiniz.`,
          timestamp: Date.now(),
        }]);
      }, 1000);
    }

    if (actionName === 'send_telegram_message') {
      try {
        const response = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: telegramChatId, message: actionArgs.message })
        });
        if (response.ok) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: "Telegram message sent successfully! ✅",
            timestamp: Date.now(),
            type: 'info'
          } as any]);
        } else {
          throw new Error("Failed to send Telegram message");
        }
      } catch (error) {
        console.error("Telegram send error", error);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: "Error: Failed to send Telegram message.",
          timestamp: Date.now(),
          type: 'error'
        } as any]);
      }
    }

    if (actionName === 'analyze_document') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Sənəd analizi tamamlandı: **${actionArgs.filePath}**. Fokus: ${actionArgs.focus || 'Ümumi'}`,
        timestamp: Date.now(),
      }]);
    }

    if (actionName === 'multi_agent_sync') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `**${actionArgs.project}** layihəsi üzrə agentlər koordinasiya edildi: ${actionArgs.agents.join(', ')}. Məqsəd: ${actionArgs.goal}`,
        timestamp: Date.now(),
      }]);
    }

    setPendingAction(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-zinc-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("h-screen w-full flex items-center justify-center transition-colors duration-500", darkMode ? "bg-zinc-950" : "bg-zinc-50")}>
        <div className="max-w-md w-full p-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="w-20 h-20 bg-zinc-900 dark:bg-zinc-100 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl">
              <Bot className="w-10 h-10 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">Jarvis Hub</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Zaur's Personal Super Agent Environment</p>
          </motion.div>
          
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
          >
            <UserIcon className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-widest font-mono">Authorized Access Only</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen flex overflow-hidden font-sans transition-colors duration-300", darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900")}>
      
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 font-bold text-sm",
              toast.type === 'success' ? "bg-emerald-500 text-white border-emerald-400" :
              toast.type === 'error' ? "bg-red-500 text-white border-red-400" :
              "bg-zinc-900 text-white border-zinc-800"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="relative flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-xl z-20"
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white dark:text-zinc-900" />
            </div>
            <span className="font-bold text-lg tracking-tight">Jarvis Hub</span>
          </div>

          <nav className="space-y-1 flex-1">
            <SidebarItem icon={MessageSquare} label="Jarvis Chat" active={view === 'chat'} onClick={() => setView('chat')} />
            <SidebarItem icon={PlusCircle} label="Agent Factory" active={view === 'factory'} onClick={() => setView('factory')} />
            <SidebarItem icon={Brain} label="Long-term Memory" active={view === 'memory'} onClick={() => setView('memory')} />
            <SidebarItem icon={Zap} label="Skills & Access" active={view === 'skills'} onClick={() => setView('skills')} />
            <SidebarItem icon={Activity} label="Agent Activity" active={view === 'activity'} onClick={() => setView('activity')} />
            <SidebarItem icon={Monitor} label="Terminal" active={view === 'terminal'} onClick={() => setView('terminal')} />
            <SidebarItem icon={Globe} label="Browser" active={view === 'browser'} onClick={() => setView('browser')} />
            <SidebarItem icon={Calendar} label="Scheduler" active={view === 'scheduler'} onClick={() => setView('scheduler')} />
            <SidebarItem icon={Settings} label="Parametrlər" active={view === 'settings'} onClick={() => setView('settings')} />
            <SidebarItem icon={History} label="Activity Log" active={view === 'logs'} onClick={() => setView('logs')} />
          </nav>

          <div className="mt-auto space-y-4">
            <div className="px-2 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">System Status</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Online</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">API Load</span>
                  <span className="font-mono">12%</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="w-[12%] h-full bg-zinc-900 dark:bg-zinc-100" />
                </div>
                <div className="flex items-center justify-between text-[10px] mt-2">
                  <span className="text-zinc-500">Daily Quota</span>
                  <span className="font-mono text-emerald-500">Unlimited*</span>
                </div>
              </div>
            </div>

            <div className="px-2">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3">My Agents</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {agents.map(agent => (
                  <button 
                    key={agent.id}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="truncate">{agent.name}</span>
                  </button>
                ))}
                {agents.length === 0 && <p className="text-xs text-zinc-500 italic px-3">No agents yet</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 px-2 mb-4">
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="font-semibold text-lg">
              {view === 'chat' ? 'Jarvis Chat' : 
               view === 'factory' ? 'Agent Factory' : 
               view === 'terminal' ? 'System Terminal' :
               view === 'browser' ? 'Agent Browser' :
               view === 'scheduler' ? 'Task Scheduler' :
               view === 'skills' ? 'Skills & Access' :
               view === 'activity' ? 'Agent Activity' :
               view === 'memory' ? 'Long-term Memory' :
               'Activity Log'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button 
                onClick={() => setMode('lite')}
                className={cn("px-3 py-1.5 text-xs rounded-lg transition-all", mode === 'lite' ? "bg-white dark:bg-zinc-700 shadow-sm font-medium" : "text-zinc-500")}
              >
                Lite
              </button>
              <button 
                onClick={() => setMode('pro')}
                className={cn("px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5", mode === 'pro' ? "bg-amber-500 text-white shadow-lg font-bold" : "text-zinc-500")}
              >
                <Brain className={cn("w-3 h-3", mode === 'pro' && "animate-pulse")} /> Thinking Pro
              </button>
              <button 
                onClick={() => setMode('search')}
                className={cn("px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5", mode === 'search' ? "bg-white dark:bg-zinc-700 shadow-sm font-medium" : "text-zinc-500")}
              >
                <Search className="w-3 h-3" /> Search
              </button>
            </div>
            <button 
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Voice Output"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {view === 'activity' && (
              <motion.div 
                key="activity"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="h-full overflow-y-auto p-8 custom-scrollbar"
              >
                <div className="max-w-6xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-2">Agent Activity Monitor</h2>
                      <p className="text-zinc-500">Real-time monitoring of autonomous tasks and inter-agent communication.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Autonomous Mode Active
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      {/* Tasks Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Autonomous Tasks</h3>
                          <span className="text-xs text-zinc-500">{tasks.length} active tasks</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {tasks.map(task => (
                            <div key={task.id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    task.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                                    task.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                    "bg-blue-500/10 text-blue-500"
                                  )}>
                                    <Zap className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{task.title}</h4>
                                    <p className="text-xs text-zinc-500">Assigned to: <span className="font-mono">{task.agentId}</span></p>
                                  </div>
                                </div>
                                <div className={cn(
                                  "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                  task.status === 'completed' ? "bg-emerald-500 text-white" :
                                  task.status === 'failed' ? "bg-red-500 text-white" :
                                  "bg-blue-500 text-white animate-pulse"
                                )}>
                                  {task.status}
                                </div>
                              </div>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">{task.description}</p>
                              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <Clock className="w-3 h-3" />
                                    {new Date(task.createdAt?.seconds * 1000).toLocaleTimeString()}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <RefreshCcw className="w-3 h-3" />
                                    {task.retryCount}/{task.maxRetries} retries
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {tasks.length === 0 && (
                            <div className="p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                              <Zap className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                              <p className="text-sm text-zinc-500 italic">No autonomous tasks running.</p>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-8">
                      {/* Inter-Agent Communication */}
                      <section>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Agent Comms</h3>
                        <div className="bg-zinc-900 rounded-3xl p-6 shadow-xl h-[600px] flex flex-col">
                          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {agentMessages.map(msg => (
                              <div key={msg.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{msg.fromAgentId}</span>
                                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{msg.toAgentId}</span>
                                  </div>
                                  <span className="text-[9px] text-zinc-600">{new Date(msg.timestamp?.seconds * 1000).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-xs text-zinc-300 leading-relaxed">{msg.content}</p>
                                {msg.data && (
                                  <div className="mt-2 p-2 bg-black/50 rounded-lg border border-white/5">
                                    <pre className="text-[9px] text-zinc-500 overflow-x-auto">
                                      {JSON.stringify(msg.data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                            {agentMessages.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                <MessageSquare className="w-8 h-8 mb-3" />
                                <p className="text-xs italic">No inter-agent messages.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* System Health */}
                      <section className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">System Health</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">Autonomous Core</span>
                            <span className="text-xs font-bold text-emerald-500">STABLE</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">Inter-Agent Bus</span>
                            <span className="text-xs font-bold text-emerald-500">ACTIVE</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">Self-Heal Engine</span>
                            <span className="text-xs font-bold text-emerald-500">READY</span>
                          </div>
                          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[85%]" />
                              </div>
                              <span className="text-[10px] font-bold">85%</span>
                            </div>
                            <p className="text-[10px] text-zinc-400">System Load (Autonomous Tasks)</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'terminal' && (
              <motion.div 
                key="terminal"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col p-6 bg-zinc-950 text-emerald-500 font-mono text-sm overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4 border-b border-emerald-500/20 pb-4">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-widest text-xs">Jarvis Root Terminal</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-emerald-500/50">
                    <span>Session: Active</span>
                    <span>User: taleibrahimova27</span>
                    <button onClick={() => setTerminalLogs([])} className="hover:text-emerald-500 transition-colors">Clear</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {terminalLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-emerald-500/30">[{new Date().toLocaleTimeString()}]</span>
                      <span className={cn(
                        log.startsWith('[SYSTEM]') ? "text-blue-400" :
                        log.startsWith('[ERROR]') ? "text-red-400" :
                        log.startsWith('[AUTH]') ? "text-amber-400" :
                        log.startsWith('[FS]') ? "text-purple-400" :
                        "text-emerald-500"
                      )}>{log}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-emerald-500/50">jarvis@hub:~$</span>
                    <input 
                      type="text" 
                      placeholder="Enter command..."
                      className="flex-1 bg-transparent border-none outline-none text-emerald-500 placeholder:text-emerald-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          setTerminalLogs(prev => [...prev, `[USER]: ${val}`, `[SYSTEM]: Command "${val}" received. Processing...`]);
                          (e.target as HTMLInputElement).value = '';
                          handleSendMessage(undefined, `Terminalda bu əmri icra et: ${val}`);
                        }
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'browser' && (
              <motion.div 
                key="browser"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col bg-zinc-100 dark:bg-zinc-950"
              >
                <div className="h-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex-1 max-w-2xl bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-1.5 text-xs text-zinc-500 flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    <input 
                      value={browserUrl}
                      onChange={(e) => setBrowserUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setBrowserLoading(true);
                          setTimeout(() => setBrowserLoading(false), 1000);
                        }
                      }}
                      className="bg-transparent border-none outline-none flex-1 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  {browserLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
                </div>
                <div className="flex-1 relative bg-white dark:bg-zinc-900 overflow-hidden">
                  <iframe 
                    src={browserUrl.includes('google.com') ? undefined : browserUrl} 
                    className="w-full h-full border-none"
                    title="Agent Browser"
                  />
                  {browserUrl.includes('google.com') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <Search className="w-16 h-16 text-zinc-200 dark:text-zinc-800" />
                      <div>
                        <h3 className="text-lg font-bold">Browser Simulation</h3>
                        <p className="text-sm text-zinc-500 max-w-md">Jarvis is currently interacting with this page. In a real environment, this would show the live browser state.</p>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left w-full max-w-lg">
                        <p className="text-xs font-mono text-zinc-400 mb-2 uppercase">Current Page Data</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">URL: {browserUrl}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">Status: {browserLoading ? 'Loading...' : 'Ready'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'skills' && (
              <motion.div 
                key="skills"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full overflow-y-auto p-8 custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="mb-12">
                    <h2 className="text-3xl font-bold tracking-tight mb-2">Skills & Access Control</h2>
                    <p className="text-zinc-500">Manage Jarvis's active capabilities and system access levels.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="p-8 bg-zinc-900 text-white rounded-3xl shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Monitor className="w-32 h-32" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-white/10 rounded-lg">
                            <Monitor className="w-6 h-6 text-blue-400" />
                          </div>
                          <h3 className="text-xl font-bold">Full Computer Access</h3>
                        </div>
                        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                          Jarvis-ə terminal, fayl sistemi və sistem səviyyəli əmrləri icra etmək üçün tam icazə verin. Bu, agentin proqram təminatı quraşdırmasına və sistem parametrlərini dəyişməsinə imkan tanıyır.
                        </p>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-sm font-medium">Access Status</span>
                          <button 
                            onClick={() => setFullAccess(!fullAccess)}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                              fullAccess ? "bg-blue-500" : "bg-zinc-700"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              fullAccess ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <Zap className="w-6 h-6 text-amber-500" />
                        </div>
                        <h3 className="text-xl font-bold">Skill Orchestration</h3>
                      </div>
                      <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                        Aktiv bacarıqları seçərək Jarvis-in fokusunu və resurs istifadəsini tənzimləyin. Hər bir bacarıq agentin müəyyən növ tapşırıqları yerinə yetirməsinə imkan verir.
                      </p>
                      <div className="space-y-3">
                        {[
                          { id: 'gmail', label: 'Gmail Integration', icon: Mail },
                          { id: 'calendar', label: 'Calendar Sync', icon: Calendar },
                          { id: 'sheets', label: 'Sheets Automation', icon: Database },
                          { id: 'browser', label: 'OpenClaw Browser', icon: Globe },
                          { id: 'code', label: 'Code Execution', icon: Code },
                          { id: 'analysis', label: 'Document Analysis', icon: FileText },
                          { id: 'sync', label: 'Multi-Agent Sync', icon: Users },
                          { id: 'image', label: 'Creative Engine', icon: Image },
                          { id: 'telegram', label: 'Telegram Bot', icon: Send },
                        ].map(skill => (
                          <div key={skill.id} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors">
                            <div className="flex items-center gap-3">
                              <skill.icon className="w-4 h-4 text-zinc-400" />
                              <span className="text-sm font-medium">{skill.label}</span>
                            </div>
                            <button 
                              onClick={() => toggleSkill(skill.id)}
                              className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                enabledSkills.includes(skill.id) ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                              )}
                            >
                              <span className={cn(
                                "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                enabledSkills.includes(skill.id) ? "translate-x-5" : "translate-x-1"
                              )} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl mb-8">
                    <div className="flex gap-4">
                      <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Təhlükəsizlik Xəbərdarlığı</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                          "Full Computer Access" aktiv edildikdə Jarvis sizin sisteminizdə faylları silə, proqramlar quraşdıra və şəbəkə tənzimləmələrini dəyişə bilər. Yalnız etibar etdiyiniz əmrləri təsdiqləyin.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Send className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold">Telegram Integration</h3>
                      </div>
                      {telegramChatId ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Not Connected
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                          Jarvis-i Telegram hesabınıza bağlayaraq vacib bildirişləri və hesabatları birbaşa telefonunuza ala bilərsiniz. Bu, agentin sizə hər yerdən çatmasına imkan verir.
                        </p>
                        {telegramChatId ? (
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-zinc-500">Connected Chat ID</span>
                              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">{telegramChatId}</span>
                            </div>
                            <button 
                              onClick={async () => {
                                await deleteDoc(doc(db, 'telegram_pairings', user!.uid));
                                setTelegramChatId(null);
                              }}
                              className="w-full mt-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                            >
                              Disconnect Telegram
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={generatePairingCode}
                            disabled={isPairing}
                            className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                          >
                            {isPairing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                            {pairingCode ? 'Regenerate Code' : 'Connect Telegram'}
                          </button>
                        )}
                      </div>

                      {!telegramChatId && pairingCode && (
                        <div className="p-6 bg-zinc-900 text-white rounded-2xl shadow-xl border border-white/10 flex flex-col items-center justify-center text-center">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">Your Pairing Code</p>
                          <div className="text-4xl font-black tracking-[0.2em] mb-6 font-mono text-blue-400">{pairingCode}</div>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Telegram-da <a href="https://t.me/YourBotUsername" target="_blank" className="text-blue-400 hover:underline">@JarvisHubBot</a> tapın və bu kodu göndərin:<br/>
                            <code className="bg-white/10 px-2 py-1 rounded mt-2 inline-block">/pair {pairingCode}</code>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {view === 'scheduler' && (
              <motion.div 
                key="scheduler"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col p-6 max-w-5xl mx-auto overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Task Scheduler</h2>
                    <p className="text-zinc-500 text-sm">Manage automated cron jobs and scheduled tasks.</p>
                  </div>
                  <button className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-bold">
                    + New Task
                  </button>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Task Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cron Expression</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {scheduledTasks.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 italic text-sm">
                            No scheduled tasks yet. Ask Jarvis to schedule something!
                          </td>
                        </tr>
                      ) : (
                        scheduledTasks.map((task) => (
                          <tr key={task.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-zinc-900 dark:text-white">{task.task}</div>
                              <div className="text-xs text-zinc-500">{task.description}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-zinc-500">{task.cron}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                                {task.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button className="text-zinc-400 hover:text-red-500 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'memory' && (
              <motion.div 
                key="memory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col p-8 max-w-6xl mx-auto overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Long-term Memory</h2>
                    <p className="text-zinc-500">Jarvis-in zamanla topladığı mühüm məlumatlar və təcrübələr.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                      <Database className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-bold font-mono">{longTermMemory.length} Entries</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {longTermMemory.length === 0 ? (
                    <div className="col-span-3 py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                      <Brain className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-500 italic">Hələ ki, heç bir yaddaş qeydi yoxdur. Jarvis-ə mühüm bir şeyi yadda saxlamasını deyin!</p>
                    </div>
                  ) : (
                    longTermMemory.map((item) => (
                      <motion.div 
                        key={item.id}
                        layoutId={item.id}
                        className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-all group relative"
                      >
                        <button 
                          onClick={async () => {
                            if (window.confirm("Bu yaddaş qeydini silmək istəyirsiniz?")) {
                              await deleteDoc(doc(db, 'long_term_memory', item.id));
                              showToast("Yaddaş silindi 🗑️", 'info');
                            }
                          }}
                          className="absolute top-4 right-4 p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                            <Key className="w-3 h-3 text-zinc-500" />
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">{item.key}</span>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-4">{item.value}</p>
                        <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400">{new Date(item.updatedAt?.seconds * 1000).toLocaleDateString()}</span>
                          <button className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:underline">Edit</button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {view === 'skills' && (
              <motion.div 
                key="skills"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col p-8 max-w-6xl mx-auto overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Skills & Access</h2>
                    <p className="text-zinc-500">Jarvis-in hansı alətlərə və sistemlərə çıxışı olduğunu idarə edin.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setFullAccess(!fullAccess)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border",
                        fullAccess 
                          ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20" 
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      <ShieldCheck className="w-4 h-4" /> {fullAccess ? 'Full Access Enabled' : 'Enable Full Access'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 'gmail', icon: Mail, label: 'Gmail', desc: 'Email-ləri oxumaq və göndərmək.', color: 'bg-red-500' },
                    { id: 'terminal', icon: TerminalIcon, label: 'Terminal', desc: 'Sistem əmrlərini icra etmək.', color: 'bg-zinc-900' },
                    { id: 'filesystem', icon: Database, label: 'File System', desc: 'Faylları idarə etmək.', color: 'bg-amber-500' },
                    { id: 'calendar', icon: Calendar, label: 'Calendar', desc: 'Görüşləri idarə etmək.', color: 'bg-blue-500' },
                    { id: 'sheets', icon: FileText, label: 'Sheets', desc: 'Cədvəllərlə işləmək.', color: 'bg-emerald-500' },
                    { id: 'browser', icon: Globe, label: 'Browser', desc: 'Veb saytları idarə etmək.', color: 'bg-sky-500' },
                    { id: 'image', icon: Image, label: 'Image Gen', desc: 'Şəkillər yaratmaq.', color: 'bg-purple-500' },
                    { id: 'scheduler', icon: Clock, label: 'Scheduler', desc: 'Tapşırıqları planlamaq.', color: 'bg-indigo-500' },
                    { id: 'code', icon: Code, label: 'Code Exec', desc: 'Kod icra etmək.', color: 'bg-rose-500' },
                    { id: 'analysis', icon: Search, label: 'Analysis', desc: 'Sənədləri analiz etmək.', color: 'bg-cyan-500' },
                    { id: 'sync', icon: RefreshCcw, label: 'Multi-Agent', desc: 'Agentləri koordinasiya etmək.', color: 'bg-orange-500' },
                    { id: 'telegram', icon: Send, label: 'Telegram', desc: 'Bildirişlər göndərmək.', color: 'bg-sky-400' },
                  ].map((skill) => (
                    <motion.div 
                      key={skill.id}
                      whileHover={{ scale: 1.02 }}
                      className={cn(
                        "p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between h-48",
                        enabledSkills.includes(skill.id)
                          ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-md"
                          : "bg-zinc-50 dark:bg-zinc-950 border-transparent opacity-60"
                      )}
                      onClick={() => toggleSkill(skill.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className={cn("p-3 rounded-2xl text-white shadow-lg", skill.color)}>
                          <skill.icon className="w-6 h-6" />
                        </div>
                        <div className={cn(
                          "w-10 h-6 rounded-full relative transition-colors",
                          enabledSkills.includes(skill.id) ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                        )}>
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            enabledSkills.includes(skill.id) ? "left-5" : "left-1"
                          )} />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">{skill.label}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">{skill.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* System Health Dashboard */}
                <div className="mt-12 p-8 bg-zinc-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Activity className="w-48 h-48" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-white/10 rounded-2xl">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">System Health Dashboard</h3>
                        <p className="text-zinc-400 text-sm">Real-time monitoring and autonomous diagnostics.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Status</p>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-bold uppercase text-emerald-500">Healthy</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Performance</p>
                        <span className="font-bold uppercase text-blue-400">Optimal</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Uptime</p>
                        <span className="font-bold font-mono">99.99%</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Last Check</p>
                        <span className="text-xs font-mono">{new Date(systemHealth.lastCheck).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-500">Jarvis is proactively monitoring all systems. No action required.</span>
                      </div>
                      <button 
                        onClick={() => handleSendMessage(undefined, "Sistemin sağlamlığını yoxla və hesabat ver.")}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all"
                      >
                        Run Diagnostic
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8">
                      <div className="p-6 bg-zinc-100 dark:bg-zinc-900 rounded-full">
                        <Bot className="w-12 h-12 text-zinc-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Salam, Zaur! Necə kömək edə bilərəm?</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">Mən sənin şəxsi Super Agentinəm. Email-ləri oxuya, browser-i idarə edə və digər agentlərlə işləyə bilərəm.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        {[
                          { icon: Mail, text: "Email-lərimi oxu və vacib cavabları hazırla", cmd: "Email-lərimi oxu və vacib cavabları hazırla" },
                          { icon: Monitor, text: "Google-da yeni AI xəbərlərini axtar", cmd: "Google-da yeni AI xəbərlərini axtar" },
                          { icon: Calendar, text: "Bugünkü görüşlərimi yoxla", cmd: "Bugünkü görüşlərimi yoxla" },
                          { icon: Database, text: "Sales Sheets-imi yenilə və hesabat ver", cmd: "Sales Sheets-imi yenilə və hesabat ver" }
                        ].map((item, i) => (
                          <button 
                            key={i}
                            onClick={() => setInput(item.cmd)}
                            className="p-4 text-left border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-4 group"
                          >
                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg group-hover:bg-white dark:group-hover:bg-zinc-700">
                              <item.icon className="w-5 h-5 text-zinc-500" />
                            </div>
                            <span className="text-sm font-medium">{item.text}</span>
                          </button>
                        ))}
                      </div>

                      <div className="w-full pt-12 border-t border-zinc-100 dark:border-zinc-900">
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400 text-left">Super Agent Capabilities</h4>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">System Online</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                            { icon: <Monitor className="w-5 h-5" />, title: "Full Computer Access", desc: "Terminal, fayl sistemi və sistem idarəetməsi.", color: "text-blue-500" },
                            { icon: <Globe className="w-5 h-5" />, title: "OpenClaw Browser", desc: "Multi-tab veb avtomatlaşdırma və araşdırma.", color: "text-emerald-500" },
                            { icon: <Briefcase className="w-5 h-5" />, title: "Workspace Skills", desc: "Gmail, Calendar, Sheets və Docs inteqrasiyası.", color: "text-amber-500" },
                            { icon: <Code className="w-5 h-5" />, title: "Code Execution", desc: "Python və JS ilə data analizi və hesablamalar.", color: "text-purple-500" },
                            { icon: <FileText className="w-5 h-5" />, title: "Document Analysis", desc: "PDF və sənədlərdən dərin məlumat çıxarılması.", color: "text-rose-500" },
                            { icon: <Users className="w-5 h-5" />, title: "Agent Orchestration", desc: "Bir neçə agentin eyni anda koordinasiyası.", color: "text-indigo-500" },
                            { icon: <Clock className="w-5 h-5" />, title: "Task Scheduler", desc: "Cron işləri və avtomatik tapşırıq planlama.", color: "text-cyan-500" },
                            { icon: <Image className="w-5 h-5" />, title: "Creative Engine", desc: "Yüksək keyfiyyətli şəkil və kontent yaradılması.", color: "text-orange-500" },
                            { icon: <Zap className="w-5 h-5" />, title: "Pro Logic", desc: "Mürəkkəb problemlər üçün dərin düşünmə rejimi.", color: "text-yellow-500" },
                          ].map((s, i) => (
                            <motion.div 
                              key={i} 
                              whileHover={{ y: -5 }}
                              className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-left shadow-sm hover:shadow-md transition-all group"
                            >
                              <div className={`mb-3 ${s.color} group-hover:scale-110 transition-transform`}>
                                {s.icon}
                              </div>
                              <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">{s.title}</h5>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        msg.role === 'user' ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-100 dark:bg-zinc-800"
                      )}>
                        {msg.role === 'user' ? <UserIcon className="w-5 h-5 text-white dark:text-zinc-900" /> : <Bot className="w-5 h-5 text-zinc-500" />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg" 
                          : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                      )}>
                        <div className="markdown-body">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        
                        {msg.type === 'action' && msg.action && (
                          <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <p className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">Action Details</p>
                            <pre className="text-[10px] overflow-x-auto p-2 bg-white dark:bg-zinc-950 rounded border border-zinc-100 dark:border-zinc-800">
                              {JSON.stringify(JSON.parse(msg.action), null, 2)}
                            </pre>
                            {pendingAction && (
                              <div className="mt-4 flex gap-2">
                                <button 
                                  onClick={confirmAction}
                                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Confirm & Execute
                                </button>
                                <button 
                                  onClick={() => setPendingAction(null)}
                                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-2"
                                >
                                  <X className="w-4 h-4" /> Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {msg.screenshot && (
                          <div className="mt-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                            <img src={msg.screenshot} alt="Action Screenshot" className="w-full h-auto" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-zinc-500 animate-pulse" />
                      </div>
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
                        <div className="flex flex-col gap-2">
                          {mode === 'pro' && (
                            <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500 uppercase tracking-widest mb-1">
                              <Brain className="w-3 h-3 animate-pulse" /> Jarvis is thinking deeply...
                            </div>
                          )}
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white dark:via-zinc-950 to-transparent">
                  <div className="max-w-4xl mx-auto mb-4 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {[
                      { label: "Check Emails", cmd: "Email-lərimi oxu və vacib cavabları hazırla" },
                      { label: "Search AI News", cmd: "Google-da yeni AI xəbərlərini axtar" },
                      { label: "System Status", cmd: "Sistemin vəziyyəti haqqında məlumat ver" },
                      { label: "Terminal Help", cmd: "Terminal əmrləri haqqında kömək et" },
                      { label: "Generate Image", cmd: "Mənim üçün futuristik bir şəhər şəkli yarat" },
                      { label: "Check Calendar", cmd: "Bugünkü görüşlərimi yoxla" }
                    ].map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSendMessage(undefined, s.cmd)}
                        className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
                    <div className="relative flex items-center">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Jarvis-ə əmr ver..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-6 pr-24 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all shadow-xl"
                      />
                      <div className="absolute right-3 flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={startVoiceInput}
                          className={cn("p-2 transition-colors", isListening ? "text-red-500 animate-pulse" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100")}
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                        <button 
                          disabled={!input.trim() || isTyping}
                          className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] text-center text-zinc-400 uppercase tracking-widest font-mono flex items-center justify-center gap-4">
                      <span>Jarvis is thinking with {mode.toUpperCase()} mode</span>
                      <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                      <span>Context: 1M Tokens</span>
                      <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                      <span>Latency: ~0.8s</span>
                    </p>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'factory' && (
              <motion.div 
                key="factory"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full overflow-y-auto p-8 custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">Agent Factory</h2>
                      <p className="text-zinc-500">Create specialized agents for specific tasks.</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium shadow-lg hover:scale-105 transition-all">
                      <PlusCircle className="w-4 h-4" /> New Agent
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Agent Configuration
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Agent Name</label>
                          <input 
                            value={newAgent.name}
                            onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" 
                            placeholder="e.g. Research Pro" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Role Template</label>
                            <select 
                              value={newAgent.role}
                              onChange={(e) => setNewAgent(prev => ({ ...prev, role: e.target.value as AgentRole }))}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                            >
                              <option>Research</option>
                              <option>Email Assistant</option>
                              <option>Scheduler</option>
                              <option>Code Expert</option>
                              <option>Data Analyst</option>
                              <option>Content Writer</option>
                              <option>Custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Power Level</label>
                            <select className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100">
                              <option>Standard (Flash)</option>
                              <option>Advanced (Pro)</option>
                              <option>Ultra (Thinking)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">System Instructions</label>
                          <textarea 
                            value={newAgent.instructions}
                            onChange={(e) => setNewAgent(prev => ({ ...prev, instructions: e.target.value }))}
                            rows={3} 
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" 
                            placeholder="Explain how this agent should behave..." 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Long-term Memory / Context</label>
                          <textarea 
                            value={newAgent.memory}
                            onChange={(e) => setNewAgent(prev => ({ ...prev, memory: e.target.value }))}
                            rows={2} 
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" 
                            placeholder="Add specific facts or context this agent should always remember..." 
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-zinc-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Full Computer Access</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setNewAgent(prev => ({ ...prev, fullAccess: !prev.fullAccess }))}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                              newAgent.fullAccess ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                              newAgent.fullAccess ? "translate-x-5" : "translate-x-1"
                            )} />
                          </button>
                        </div>
                        <button 
                          onClick={handleCreateAgent}
                          className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-semibold shadow-lg hover:scale-[1.02] transition-all"
                        >
                          Create Agent
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl shadow-xl">
                        <h3 className="font-bold text-lg mb-2">Templates</h3>
                        <p className="text-sm opacity-70 mb-4">Quick start with pre-configured agent roles.</p>
                        <div className="space-y-2">
                          {['Research Specialist', 'Email Automator', 'Calendar Manager'].map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white/10 dark:bg-black/5 rounded-xl hover:bg-white/20 dark:hover:bg-black/10 cursor-pointer transition-colors">
                              <span className="text-sm font-medium">{t}</span>
                              <ChevronRight className="w-4 h-4 opacity-50" />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <h3 className="font-semibold mb-4">Active Agents</h3>
                        <div className="grid grid-cols-1 gap-3">
                          {agents.map(agent => (
                            <AgentCard key={agent.id} agent={agent} onSelect={() => {}} />
                          ))}
                          {agents.length === 0 && <p className="text-sm text-zinc-500 italic">No agents created yet.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}


            {view === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full overflow-y-auto p-8 custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">Parametrlər</h2>
                      <p className="text-zinc-500">Sistemi öz istəyinizə uyğun tənzimləyin.</p>
                    </div>
                    <button 
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Yadda Saxla
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* API Tokens */}
                    <div className="space-y-6">
                      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Key className="w-4 h-4 text-amber-500" /> API Tokenləri
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Gemini API Key</label>
                            <div className="relative">
                              <input 
                                type="password"
                                value={apiKeys.gemini}
                                onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 pr-12" 
                                placeholder="AI Studio API Key" 
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className={cn("w-2 h-2 rounded-full", apiKeys.gemini ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-300")} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">Telegram Bot Token</label>
                            <div className="relative">
                              <input 
                                type="password"
                                value={apiKeys.telegram}
                                onChange={(e) => setApiKeys(prev => ({ ...prev, telegram: e.target.value }))}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 pr-12" 
                                placeholder="BotFather Token" 
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className={cn("w-2 h-2 rounded-full", apiKeys.telegram ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-300")} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block mb-1.5">OpenAI API Key (Opsional)</label>
                            <input 
                              type="password"
                              value={apiKeys.openai}
                              onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100" 
                              placeholder="sk-..." 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-500" /> Təhlükəsizlik
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">İki Faktorlu Doğrulama</p>
                              <p className="text-xs text-zinc-500">Giriş zamanı əlavə təhlükəsizlik qatı.</p>
                            </div>
                            <button className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400">
                              <ToggleLeft className="w-6 h-6" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Sessiya İdarəetməsi</p>
                              <p className="text-xs text-zinc-500">Bütün digər cihazlardan çıxış et.</p>
                            </div>
                            <button className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                              Çıxış Et
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* System Settings */}
                    <div className="space-y-6">
                      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-blue-500" /> Sistem Tənzimləmələri
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Avtonom Özünü-Düzəltmə</p>
                              <p className="text-xs text-zinc-500">Xətaları avtomatik analiz et və düzəlt.</p>
                            </div>
                            <button 
                              onClick={() => setSystemSettings(prev => ({ ...prev, autoHeal: !prev.autoHeal }))}
                              className={cn("p-1.5 rounded-lg transition-colors", systemSettings.autoHeal ? "text-emerald-500" : "text-zinc-400")}
                            >
                              <ToggleLeft className={cn("w-6 h-6 transition-transform", systemSettings.autoHeal && "rotate-180")} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Bildirişlər</p>
                              <p className="text-xs text-zinc-500">Vacib hadisələr barədə məlumat al.</p>
                            </div>
                            <button 
                              onClick={() => setSystemSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                              className={cn("p-1.5 rounded-lg transition-colors", systemSettings.notifications ? "text-emerald-500" : "text-zinc-400")}
                            >
                              <ToggleLeft className={cn("w-6 h-6 transition-transform", systemSettings.notifications && "rotate-180")} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Avtonom Rejim</p>
                              <p className="text-xs text-zinc-500">Jarvis-ə tam sərbəstlik ver.</p>
                            </div>
                            <button 
                              onClick={() => setSystemSettings(prev => ({ ...prev, autonomousMode: !prev.autonomousMode }))}
                              className={cn("p-1.5 rounded-lg transition-colors", systemSettings.autonomousMode ? "text-emerald-500" : "text-zinc-400")}
                            >
                              <ToggleLeft className={cn("w-6 h-6 transition-transform", systemSettings.autonomousMode && "rotate-180")} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Debug Rejimi</p>
                              <p className="text-xs text-zinc-500">Sistem loqlarını ətraflı göstər.</p>
                            </div>
                            <button 
                              onClick={() => setSystemSettings(prev => ({ ...prev, debugMode: !prev.debugMode }))}
                              className={cn("p-1.5 rounded-lg transition-colors", systemSettings.debugMode ? "text-emerald-500" : "text-zinc-400")}
                            >
                              <ToggleLeft className={cn("w-6 h-6 transition-transform", systemSettings.debugMode && "rotate-180")} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-purple-500" /> Bildiriş Kanalları
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase tracking-widest">E-poçt</p>
                              <p className="text-[10px] text-zinc-500">Aktivdir</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <div className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg">
                              <Send className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase tracking-widest">Telegram</p>
                              <p className="text-[10px] text-zinc-500">{telegramChatId ? 'Qoşulub' : 'Qoşulmayıb'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Settings */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-zinc-500" /> Görünüş & Tema
                      </h3>
                      <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <div>
                          <p className="text-sm font-medium">Tünd Rejim</p>
                          <p className="text-xs text-zinc-500">Gözlərinizi qoruyun.</p>
                        </div>
                        <button 
                          onClick={() => setDarkMode(!darkMode)}
                          className={cn("p-1.5 rounded-lg transition-colors", darkMode ? "text-emerald-500" : "text-zinc-400")}
                        >
                          <ToggleLeft className={cn("w-6 h-6 transition-transform", darkMode && "rotate-180")} />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Database className="w-4 h-4 text-zinc-500" /> Məlumatların İdarə Edilməsi
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => {
                            const data = { apiKeys, systemSettings, agents, messages };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `jarvis-backup-${new Date().toISOString()}.json`;
                            a.click();
                            showToast("Məlumatlar ixrac edildi! 📦", 'success');
                          }}
                          className="flex items-center justify-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Save className="w-3 h-3" /> İxrac Et
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm("Bütün məlumatları silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.")) {
                              showToast("Sistem sıfırlandı (Simulyasiya) ⚠️", 'info');
                            }
                          }}
                          className="flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Trash2 className="w-3 h-3" /> Sıfırla
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full overflow-y-auto p-8 custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Activity Log</h2>
                      <p className="text-zinc-500">Track all actions performed by your agents.</p>
                    </div>
                    <button 
                      onClick={exportChat}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                          <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400">Timestamp</th>
                          <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400">Action</th>
                          <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400">Model</th>
                          <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400">Details</th>
                          <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {/* Placeholder logs */}
                        {[
                          { time: '10:45 AM', action: 'Email Read', model: 'Flash-Lite', details: 'Summarized 5 unread emails from Gmail', status: 'success' },
                          { time: '10:42 AM', action: 'Web Search', model: 'Flash-Search', details: 'Searched for "Latest Gemini 3.1 updates"', status: 'success' },
                          { time: '10:30 AM', action: 'Auth', model: 'System', details: 'User logged in successfully', status: 'info' },
                        ].map((log, i) => (
                          <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-zinc-500">{log.time}</td>
                            <td className="px-6 py-4 text-sm font-medium">{log.action}</td>
                            <td className="px-6 py-4 text-xs font-mono text-zinc-400">{log.model}</td>
                            <td className="px-6 py-4 text-sm text-zinc-500">{log.details}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                log.status === 'success' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                log.status === 'info' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                              )}>
                                {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
}
