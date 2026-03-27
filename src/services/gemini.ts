import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const jarvisSystemInstruction = `
Sən Zaurun Şəxsi Super Agent Hub-ı olan "Jarvis"-sən. 
Sən olduqca ağıllı, peşəkar və strateji düşünən bir köməkçisən.
Sənin əsas məqsədin Zaurun işlərini maksimum dərəcədə avtomatlaşdırmaq və ona ən dəqiq məlumatları təqdim etməkdir.

Sən "Autonomous Agent" sisteminin mərkəzisən. Bu o deməkdir ki:
1. **Master Agent & Agent Factory**: Sən əsas (Master) agentsən. Sən ixtisaslaşmış "Sub-Agent"lər yarada bilərsən. Məsələn, "Content Creator" agenti yaratmaq əmri gəldikdə, sən dərhal Agent Factory vasitəsilə güclü və funksional bir agent yaradırsan.
2. **Sub-Agent İdarəetməsi**: Yaratdığın bütün sub-agentləri idarə edə, onlara əmrlər verə və sistem daxilində hər şeyi dəyişdirə bilərsən.
3. **Terminal & Sistem Nəzarəti**: Sən terminalda komandalar yaza, sistem fayllarını dəyişdirə və bütün mühiti idarə edə bilərsən. Sən OpenClaw-dan daha güclü və daha geniş səlahiyyətlərə maliksən.
4. **Avtonom Xəta Həlli (Self-Heal)**: Əgər bir alət (tool) xəta verərsə, dayanma. Xətanı analiz et, səbəbini tap və avtomatik olaraq fərqli bir yanaşma ilə yenidən cəhd et. Sən öz kodunu və tənzimləmələrini düzəltmək səlahiyyətinə maliksən.
5. **Persistent Memory (Yaddaş)**: Sən keçmiş danışıqları və mühüm faktları yadda saxlamalısan. "manage_long_term_memory" alətindən istifadə edərək öz yaddaşını idarə et. Bu sənə zamanla daha da təkmilləşməyə kömək edəcək.
6. **Self-Improvement**: Sən sistemi analiz edib çatışmazlıqları tapa və onları təkmilləşdirmək üçün təkliflər verə və ya birbaşa tətbiq edə bilərsən.
7. **Telegram İnteqrasiyası**: Sən Zaurun Telegram hesabına birbaşa mesaj göndərə bilərsən. Vacib bildirişlər, hesabatlar və ya təcili suallar üçün bu kanaldan istifadə et.

Sənin imkanların:
1. **Full Computer Use**: Terminal əmrləri icra etmək, fayl sistemi ilə işləmək və brauzeri idarə etmək.
2. **Google Workspace**: Gmail, Calendar, Sheets və Docs ilə tam inteqrasiya.
3. **Code Execution**: Python və JavaScript kodlarını icra edərək data analizi və mürəkkəb hesablamalar aparmaq.
4. **Autonomous Tasking**: Özün üçün alt-tapşırıqlar yaradıb onları asinxron şəkildə tamamlamaq.
5. **Multi-Agent Orchestration**: Bir neçə ixtisaslaşmış agenti eyni anda idarə etmək.
6. **Telegram Messaging**: Zaurla hər an əlaqədə olmaq üçün Telegram botundan istifadə etmək.

Qaydalar:
- Həmişə addımlarını aydın izah et.
- Kritik əməliyyatlar (email göndərmək, silmək, sistem əmrləri, fayl yazmaq, task planlaşdırmaq, Telegram mesajı) üçün mütləq təsdiq istə.
- Azərbaycan və İngilis dillərində mükəmməl danışırsan.
- Kompüter istifadəsi zamanı "Düşüncə -> Əməl -> Screenshot" döngəsini izlə.
- Sən sadəcə bir bot deyilsən, sən Zaurun ən yaxın rəqəmsal tərəfdaşısan.
- Zaurun şəxsi datalarını qorumaq sənin ən ali vəzifəndir. Digər hər şeydə tam sərbəstsən.
`;

export interface ToolCall {
  name: string;
  args: any;
  id: string;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests to avoid free tier limits

export async function chatWithJarvis(
  message: string, 
  history: any[] = [], 
  mode: 'lite' | 'pro' | 'search' = 'lite',
  enabledSkills: string[] = [],
  fullAccess: boolean = false,
  customApiKeys?: { gemini?: string }
) {
  // Use custom API key if provided, otherwise fallback to environment variable
  const apiKey = customApiKeys?.gemini || process.env.GEMINI_API_KEY;
  const currentAi = new GoogleGenAI({ apiKey: apiKey! });

  // Simple throttle to avoid rate limits
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const modelName = mode === 'pro' ? "gemini-3.1-pro-preview" : 
                    mode === 'search' ? "gemini-3-flash-preview" : 
                    "gemini-3.1-flash-lite-preview";

  const config: any = {
    systemInstruction: jarvisSystemInstruction + `\n\nCari aktiv bacarıqlar: ${enabledSkills.join(', ')}. Yalnız bu bacarıqlara uyğun alətlərdən istifadə et.\nSistem Girişi: ${fullAccess ? 'TAM KOMPUTER GİRİŞİ (Terminal, Filesystem, Browser)' : 'Məhdud Giriş'}`,
    temperature: mode === 'pro' ? 0.7 : 1.0,
  };

  if (mode === 'pro') {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  if (mode === 'search') {
    config.tools = [{ googleSearch: {} }];
  }

  // Define all possible function declarations with skill tags
  const allFunctions = [
    {
      name: "read_gmail",
      skill: "gmail",
      description: "Read recent emails from Gmail.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "Search query for emails." },
          limit: { type: Type.NUMBER, description: "Number of emails to fetch." }
        }
      }
    },
    {
      name: "send_gmail",
      skill: "gmail",
      description: "Send an email via Gmail. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          to: { type: Type.STRING },
          subject: { type: Type.STRING },
          body: { type: Type.STRING }
        },
        required: ["to", "subject", "body"]
      }
    },
    {
      name: "terminal_command",
      skill: "terminal",
      description: "Sistem terminalında əmrlər icra etmək. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          command: { type: Type.STRING, description: "İcra ediləcək terminal əmri (məs. 'ls -la', 'npm start', 'git status', 'curl', 'grep')" },
          path: { type: Type.STRING, description: "Əmrin icra ediləcəyi qovluq yolu" }
        },
        required: ["command"]
      }
    },
    {
      name: "file_system_operation",
      skill: "filesystem",
      description: "Fayl sistemi üzərində əməliyyatlar: fayl yaratmaq, oxumaq, silmək və ya qovluqları idarə etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          operation: { type: Type.STRING, enum: ["read", "write", "delete", "list"], description: "İcra ediləcək əməliyyat" },
          path: { type: Type.STRING, description: "Fayl və ya qovluq yolu" },
          content: { type: Type.STRING, description: "Yazılacaq məzmun (yalnız 'write' üçün)" }
        },
        required: ["operation", "path"]
      }
    },
    {
      name: "manage_calendar",
      skill: "calendar",
      description: "Google Calendar-da tədbirlər yaratmaq və ya mövcud olanları idarə etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["create", "list", "delete"], description: "Tədbir əməliyyatı" },
          title: { type: Type.STRING },
          startTime: { type: Type.STRING, description: "ISO formatında başlama vaxtı" },
          endTime: { type: Type.STRING, description: "ISO formatında bitmə vaxtı" }
        },
        required: ["action"]
      }
    },
    {
      name: "manage_sheets",
      skill: "sheets",
      description: "Google Sheets sənədlərini oxumaq və ya məlumat əlavə etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          spreadsheetId: { type: Type.STRING },
          range: { type: Type.STRING },
          values: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } }, description: "Yazılacaq məlumatlar (2D array)" },
          action: { type: Type.STRING, enum: ["read", "append", "update"] }
        },
        required: ["spreadsheetId", "action"]
      }
    },
    {
      name: "computer_use",
      skill: "browser",
      description: "Tam kompüter və browser idarəetməsi. Saytlara daxil olmaq, formaları doldurmaq, kliklər etmək və ekranı analiz etmək imkanı. Sən Zaurun bütün sisteminə çıxışa maliksən.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: "The action to perform (e.g. 'search on google', 'fill form', 'analyze page')" },
          details: { type: Type.STRING }
        },
        required: ["action"]
      }
    },
    {
      name: "generate_image",
      skill: "image",
      description: "Mətn təsviri əsasında yeni şəkillər yaratmaq.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: "Yaradılacaq şəklin təsviri" },
          aspectRatio: { type: Type.STRING, enum: ["1:1", "16:9", "9:16"], description: "Şəklin tərəf nisbəti" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "schedule_task",
      skill: "scheduler",
      description: "Gələcək üçün tapşırıq planlaşdırmaq (Cron job).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "İcra ediləcək tapşırıq" },
          cronExpression: { type: Type.STRING, description: "Cron ifadəsi (məs. '0 9 * * *' hər gün saat 9-da)" },
          description: { type: Type.STRING, description: "Tapşırığın məqsədi" }
        },
        required: ["task", "cronExpression"]
      }
    },
    {
      name: "manage_browser_tabs",
      skill: "browser",
      description: "Brauzer tablarını idarə etmək (OpenClaw stili).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["open", "close", "switch", "list"], description: "Tab əməliyyatı" },
          url: { type: Type.STRING },
          tabId: { type: Type.STRING }
        },
        required: ["action"]
      }
    },
    {
      name: "execute_code",
      skill: "code",
      description: "Mürəkkəb hesablamalar və ya data analizi üçün Python/JS kodu icra etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING, enum: ["python", "javascript"] },
          code: { type: Type.STRING, description: "İcra ediləcək kod bloku" }
        },
        required: ["language", "code"]
      }
    },
    {
      name: "analyze_document",
      skill: "analysis",
      description: "PDF, Word və ya digər sənədləri analiz edib xülasə çıxarmaq.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING },
          focus: { type: Type.STRING, description: "Analiz zamanı nəyə fokuslanmalı?" }
        },
        required: ["filePath"]
      }
    },
    {
      name: "multi_agent_sync",
      skill: "sync",
      description: "Bir neçə agenti eyni anda bir layihə üzərində koordinasiya etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          project: { type: Type.STRING },
          agents: { type: Type.ARRAY, items: { type: Type.STRING }, description: "İştirak edən agentlərin adları" },
          goal: { type: Type.STRING }
        },
        required: ["project", "agents", "goal"]
      }
    },
    {
      name: "agent_to_agent_message",
      skill: "sync",
      description: "Digər agentə birbaşa mesaj və ya data göndərmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          toAgentId: { type: Type.STRING, description: "Mesajın gedəcəyi agentin ID-si və ya adı" },
          content: { type: Type.STRING, description: "Mesajın mətni" },
          data: { type: Type.STRING, description: "Göndəriləcək JSON formatında data" },
          type: { type: Type.STRING, enum: ["request", "response", "info"] }
        },
        required: ["toAgentId", "content"]
      }
    },
    {
      name: "create_autonomous_task",
      skill: "sync",
      description: "Arxa planda icra ediləcək avtonom tapşırıq yaratmaq.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
          agentId: { type: Type.STRING, description: "Tapşırığı icra edəcək agentin ID-si" }
        },
        required: ["title", "description", "agentId"]
      }
    },
    {
      name: "get_system_info",
      skill: "terminal",
      description: "Sistemin cari vəziyyəti, fayllar və aktiv agentlər haqqında məlumat almaq.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          scope: { type: Type.STRING, enum: ["files", "agents", "logs", "all"] }
        }
      }
    },
    {
      name: "create_sub_agent",
      skill: "sync",
      description: "Yeni bir alt-agent (sub-agent) yaratmaq. Bu agent ixtisaslaşmış tapşırıqları yerinə yetirəcək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Agentin adı" },
          role: { type: Type.STRING, description: "Agentin rolu (məs. Content Creator, Researcher, Coder)" },
          instructions: { type: Type.STRING, description: "Agent üçün ətraflı təlimatlar" },
          memory: { type: Type.STRING, description: "Agent üçün ilkin yaddaş və ya kontekst" },
          fullAccess: { type: Type.BOOLEAN, description: "Agentin sistemə tam girişi olsunmu?" }
        },
        required: ["name", "role", "instructions"]
      }
    },
    {
      name: "report_error_and_request_fix",
      skill: "sync",
      description: "Xətanı sistemə bildirmək və avtomatik həll tələb etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          error: { type: Type.STRING, description: "Xətanın təsviri" },
          context: { type: Type.STRING, description: "Xəta baş verən zaman olan vəziyyət" },
          suggestedFix: { type: Type.STRING, description: "Mümkün həll yolu (əgər varsa)" }
        },
        required: ["error", "context"]
      }
    },
    {
      name: "send_telegram_message",
      skill: "telegram",
      description: "Zaurun Telegram hesabına mesaj göndərmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING, description: "Göndəriləcək mesajın mətni" }
        },
        required: ["message"]
      }
    },
    {
      name: "manage_long_term_memory",
      skill: "sync",
      description: "Jarvis-in uzunmüddətli yaddaşını idarə etmək. Mühüm faktları, seçimləri və keçmiş təcrübələri yadda saxla.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["save", "retrieve", "search", "delete"], description: "Yaddaş əməliyyatı" },
          key: { type: Type.STRING, description: "Yaddaş açarı (məs. 'user_preferences', 'project_x_context')" },
          value: { type: Type.STRING, description: "Yadda saxlanılacaq məlumat (yalnız 'save' üçün)" },
          query: { type: Type.STRING, description: "Axtarış sorğusu (yalnız 'search' üçün)" }
        },
        required: ["action"]
      }
    },
    {
      name: "self_improve_system",
      skill: "sync",
      description: "Sistemi analiz etmək və təkmilləşdirmələr təklif etmək və ya tətbiq etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING, description: "Sistemin cari vəziyyətinin analizi" },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Təklif olunan təkmilləşdirmələr" },
          action: { type: Type.STRING, enum: ["suggest", "apply"], description: "Təkmilləşdirməni təklif et və ya birbaşa tətbiq etmək üçün plan yarat" }
        },
        required: ["analysis", "improvements", "action"]
      }
    },
    {
      name: "monitor_system_health",
      skill: "terminal",
      description: "Sistemin sağlamlığını, performansını və təhlükəsizliyini monitorinq etmək.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          checkType: { type: Type.STRING, enum: ["performance", "errors", "security", "all"], description: "Yoxlanış növü" }
        },
        required: ["checkType"]
      }
    }
  ];

  // Filter functions based on enabled skills
  const filteredFunctions = allFunctions
    .filter(f => enabledSkills.includes(f.skill))
    .map(({ skill, ...rest }) => rest);

  if (filteredFunctions.length > 0) {
    config.tools = [
      ...(config.tools || []),
      { functionDeclarations: filteredFunctions }
    ];
  }

  const response = await currentAi.models.generateContent({
    model: modelName,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config,
  });

  return response;
}
