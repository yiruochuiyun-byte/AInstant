import type { Metadata } from "next";
import { asLang, alternates } from "../../../lib/lang.ts";
import { dict } from "../../../lib/i18n.ts";

// Draft. Operator name, address and contact must be filled in, and a lawyer should review before launch
// (GDPR; a German edition also needs an Impressum).
const OPERATOR = process.env.SITE_OPERATOR ?? "[operator name, address, contact email]";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const lang = asLang((await params).lang);
  return { title: dict(lang).privacy, alternates: alternates(lang, "/privacy") };
}

const EN = (
  <>
    <p>Controller: {OPERATOR}.</p>
    <h2>What we collect</h2>
    <ul>
      <li><strong>Newsletter:</strong> your email address, language and time zone, and when you confirmed or unsubscribed. Legal basis: your consent (Art. 6(1)(a) GDPR), given by double opt-in. We send through Resend (email delivery processor). Unsubscribe with the link in every email; we then stop sending and delete the address within 30 days.</li>
      <li><strong>Analytics:</strong> we use Plausible, which sets no cookies and stores no personal data or IP addresses.</li>
      <li><strong>Embedded posts from X:</strong> loaded only after you click “Load posts from X”. X then receives your IP address and may set cookies under its own privacy policy. Your choice is stored in your browser (local storage) and can be cleared there.</li>
      <li><strong>Hosting:</strong> Vercel (website) and Supabase (database) process server logs to run the service.</li>
    </ul>
    <h2>Your rights</h2>
    <p>You can ask for access, correction, deletion, restriction, portability, or object, and you can complain to a data protection authority. Write to the contact above.</p>
    <h2>Content</h2>
    <p>We show headlines, our own short summaries and links to the original sources. We do not copy full articles or re-host videos. Sponsored content is always labelled “Sponsored”. Corrections are listed on each story page.</p>
  </>
);

const ZH = (
  <>
    <p>数据控制者：{OPERATOR}。</p>
    <h2>我们收集什么</h2>
    <ul>
      <li><strong>每日邮件：</strong>你的邮箱、语言、时区，以及确认和退订时间。法律依据是你的同意（GDPR 第 6(1)(a) 条），通过双重确认取得。邮件经 Resend 发送。每封邮件都有退订链接，退订后停止发送，并在 30 天内删除邮箱。</li>
      <li><strong>统计：</strong>使用 Plausible，不设置 Cookie，不保存个人数据或 IP 地址。</li>
      <li><strong>X 帖子嵌入：</strong>只有在你点击“加载 X 帖子”后才加载。此时 X 会收到你的 IP 地址并可能按其隐私政策设置 Cookie。你的选择保存在浏览器本地存储中，可随时清除。</li>
      <li><strong>托管：</strong>Vercel（网站）和 Supabase（数据库）为运行服务处理服务器日志。</li>
    </ul>
    <h2>你的权利</h2>
    <p>你可以要求查询、更正、删除、限制处理、数据转移或提出异议，也可以向数据保护机构投诉。请通过上方联系方式联系我们。</p>
    <h2>内容</h2>
    <p>我们只展示标题、自己撰写的简短摘要和原文链接，不搬运全文、不转存视频。赞助内容一律标注“Sponsored”。每个事件页都公开更正记录。</p>
  </>
);

export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const lang = asLang((await params).lang);
  return (
    <>
      <h1 className="event">{dict(lang).privacy}</h1>
      {lang === "zh" ? ZH : EN}
    </>
  );
}
