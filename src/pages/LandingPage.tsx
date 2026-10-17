import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  FileBarChart,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Menu,
  MessageSquare,
  Moon,
  Play,
  ShieldCheck,
  Sun,
  Timer,
  Users,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import "./LandingPage.css";

const features = [
  [FolderKanban, "مدیریت پروژه", "برنامه‌ریزی، اجرا و کنترل پروژه‌ها در یک نمای منسجم"],
  [GitBranch, "کانبان", "مدیریت جریان کار با محدودیت WIP و ستون‌های سفارشی"],
  [Layers3, "اسکرام", "اسپرینت، بک‌لاگ و رویدادهای چابک برای تیم‌های محصول"],
  [FileBarChart, "گزارش‌ها و تحلیل‌ها", "گزارش‌های مدیریتی و شاخص‌های واقعی عملکرد تیم"],
  [Users, "مدیریت تیم", "نقش‌ها، دسترسی‌ها و همکاری شفاف بین اعضا"],
  [LayoutDashboard, "فرآیندساز", "ساخت گردش‌کارهای سازمانی برای فرآیندهای تکرارشونده"],
  [Users, "اتوماسیون", "خودکارسازی گردش کار، اعلان‌ها و اقدامات پرتکرار"],
  [BarChart3, "تحلیل و BI", "نمایش داده‌های کلیدی برای تصمیم‌گیری دقیق‌تر"],
  [ShieldCheck, "امنیت", "کنترل دسترسی، نشست‌ها و حفاظت از اطلاعات سازمان"],
  [MessageSquare, "یکپارچگی‌ها", "اتصال ابزارها و سرویس‌های مورد استفاده تیم"],
  [CalendarDays, "تقویم", "مدیریت موعدها، جلسه‌ها و برنامه‌های تیمی"],
  [Clock3, "مدیریت دانش", "مستندسازی تصمیم‌ها، دانش تیم و تجربه پروژه‌ها"],
] as const;

const capabilities = [
  [MessageSquare, "ارتباطات تیمی", "گفت‌وگو، نظر و اطلاع‌رسانی در بستر هر وظیفه"],
  [FolderKanban, "مدیریت فایل‌ها", "فایل‌ها و مستندات مرتبط، همیشه در دسترس تیم"],
  [Layers3, "مدیریت وظایف", "اولویت‌بندی، مسئول، موعد و پیگیری کامل کارها"],
  [GitBranch, "یکپارچگی ابزارها", "اتصال به ابزارهای مورد استفاده سازمان شما"],
  [BarChart3, "گزارش‌ها و داشبوردها", "داده‌های قابل اعتماد برای کنترل عملکرد"],
  [Timer, "ثبت زمان", "ردیابی زمان صرف‌شده و ظرفیت واقعی تیم"],
] as const;

const methods = [
  { title: "کانبان (بهبود مستمر)", tone: "green", items: ["بردهای منعطف", "کنترل WIP", "کشف گلوگاه‌ها", "بهبود مستمر"] },
  { title: "کانبان", tone: "orange", items: ["جریان بصری کار", "محدودیت WIP", "تحلیل زمان چرخه", "اولویت‌بندی تیم"] },
  { title: "اسکرام", tone: "blue", items: ["اسپرینت‌های کوتاه", "بک‌لاگ محصول", "جلسات منظم", "گزارش پیشرفت"] },
];

function ProductPreview() {
  return (
    <div className="landing-preview" aria-label="پیش‌نمایش داشبورد کارنکس">
      <div className="preview-toolbar"><span>پیش‌نمایش نمونهٔ داشبورد</span><i /><i /><i /></div>
      <div className="preview-shell">
        <aside>{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} />)}</aside>
        <div className="preview-content">
          <div className="preview-kpis">
            {["نمای کلی", "اولویت‌ها", "همکاری", "پیشرفت"].map((label) => <article key={label}><small>{label}</small><strong>—</strong><i /></article>)}
          </div>
          <div className="preview-middle">
            <article className="preview-tasks"><h3>فهرست وظایف نمونه</h3>{["وظیفهٔ نمونه ۱", "وظیفهٔ نمونه ۲", "وظیفهٔ نمونه ۳"].map((x) => <p key={x}><span />{x}<b>نمونه</b></p>)}</article>
            <article className="preview-chart"><h3>نمودار نمونه</h3><svg viewBox="0 0 300 120" role="img" aria-label="نمودار نمونه"><path className="chart-area" d="M5 95 C45 125 65 35 105 64 S165 100 195 48 S250 20 295 70 L295 118 L5 118 Z" /><path className="chart-line" d="M5 95 C45 125 65 35 105 64 S165 100 195 48 S250 20 295 70" /></svg></article>
            <article className="preview-meetings"><h3>برنامهٔ نمونه</h3>{["رویداد نمونه ۱", "رویداد نمونه ۲", "رویداد نمونه ۳"].map((x) => <p key={x}><b>—</b><span>{x}</span></p>)}</article>
          </div>
          <div className="preview-bottom">
            <article className="preview-projects"><h3>پروژه‌های نمونه</h3>{["پروژهٔ نمونه ۱", "پروژهٔ نمونه ۲", "پروژهٔ نمونه ۳"].map((x, i) => <p key={x}><span>{x}</span><i><b style={{ width: `${78 - i * 16}%` }} /></i><small>نمونه</small></p>)}</article>
            <article className="preview-donut"><h3>وضعیت نمونه</h3><div><strong>—</strong><span>پیش‌نمایش</span></div></article>
          </div>
          <p className="preview-disclaimer">این پیش‌نمایش صرفاً برای نمایش رابط کاربری است و دادهٔ واقعی مشتری یا سازمان را نشان نمی‌دهد.</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="landing-page" dir="rtl">
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <button className="landing-brand" onClick={() => scrollTo("top")} aria-label="کارنکس"><BrandLogo variant="full" /></button>
          <nav aria-label="منوی اصلی">
            <button onClick={() => scrollTo("features")}>امکانات</button>
            <button onClick={() => scrollTo("methods")}>راهکارها</button>
            <button onClick={() => navigate("/pricing")}>قیمت‌ها</button>
            <button onClick={() => scrollTo("resources")}>منابع</button>
            <button onClick={() => scrollTo("footer")}>درباره ما</button>
          </nav>
          <div className="landing-nav-actions">
            <button className="landing-theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={resolvedTheme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</button>
            <button className="landing-button secondary" onClick={() => navigate("/login")}>ورود</button>
            <button className="landing-button primary" onClick={() => navigate("/register")}>شروع رایگان</button>
          </div>
          <button className="landing-menu" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="منوی موبایل">{mobileMenuOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileMenuOpen && <div className="landing-mobile-menu"><button onClick={() => scrollTo("features")}>امکانات</button><button onClick={() => scrollTo("methods")}>راهکارها</button><button onClick={() => navigate("/pricing")}>قیمت‌ها</button><button onClick={() => navigate("/login")}>ورود</button><button onClick={() => navigate("/register")}>شروع رایگان</button></div>}
      </header>

      <section id="top" className="landing-hero landing-container">
        <p className="eyebrow">سامانه مدیریت یکپارچه پروژه و تیم</p>
        <h1>همه پروژه‌ها، تیم‌ها و فرآیندهای سازمان‌تان<br /><span>در یک فضای یکپارچه</span></h1>
        <p className="hero-copy">از برنامه‌ریزی تا تحویل، با کارنکس مدیریت کامل پروژه‌ها و تیم‌ها را ساده کنید؛ همه‌چیز در یک سامانه واحد، امن و قابل اعتماد.</p>
        <div className="hero-actions"><button className="landing-button primary" onClick={() => navigate("/register")}>شروع رایگان <ChevronLeft /></button><button className="landing-button secondary" onClick={() => scrollTo("features")}><Play /> مشاهده امکانات</button></div>
        <ProductPreview />
      </section>

      <section id="features" className="landing-section landing-container"><div className="section-heading"><h2>هر آنچه برای مدیریت بهتر نیاز دارید</h2><p>ابزارهای کامل برای مدیریت پروژه، تیم و فرآیندهای سازمانی</p></div><div className="feature-grid">{features.map(([Icon, title, text], i) => <article key={title}><i data-tone={i % 5}><Icon /></i><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section id="methods" className="landing-section landing-container"><div className="section-heading"><h2>روش‌های مدیریت پروژه</h2><p>متناسب با سبک کاری تیم شما، روش مناسب را انتخاب کنید</p></div><div className="method-grid">{methods.map((method) => <article key={method.title} data-tone={method.tone}><h3>{method.title}</h3><div className="method-board"><span /><span /><span /></div><ul>{method.items.map((x) => <li key={x}><Check />{x}</li>)}</ul></article>)}</div></section>

      <section id="resources" className="landing-section landing-container"><div className="section-heading"><h2>قابلیت‌های کلیدی کارنکس</h2><p>ابزارهایی قدرتمند برای تیم‌های حرفه‌ای</p></div><div className="capability-grid">{capabilities.map(([Icon, title, text], i) => <article key={title}><i data-tone={i % 3}><Icon /></i><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

      <section className="landing-section landing-container"><div className="landing-cta"><div><h2>آماده شروع هستید؟</h2><p>همین امروز کارنکس را برای سازمان خود راه‌اندازی کنید.</p></div><div className="hero-actions"><button className="landing-button primary" onClick={() => navigate("/register")}>شروع رایگان <ArrowLeft /></button><button className="landing-button secondary" onClick={() => scrollTo("features")}><Play /> مشاهده امکانات</button></div></div></section>

      <footer id="footer" className="landing-footer"><div className="landing-container footer-grid"><div><BrandLogo variant="full" /><p>سامانه جامع مدیریت پروژه و همکاری تیمی.</p></div><div><h3>محصول</h3><button onClick={() => scrollTo("features")}>امکانات</button><button onClick={() => navigate("/pricing")}>قیمت‌ها</button><span className="text-muted-foreground">راهکارها</span><span className="text-muted-foreground">API</span></div><div><h3>منابع</h3><span className="text-muted-foreground">مستندات</span><span className="text-muted-foreground">وبلاگ</span><span className="text-muted-foreground">راهنما</span><span className="text-muted-foreground">وضعیت سیستم</span></div><div><h3>شرکت</h3><span className="text-muted-foreground">درباره ما</span><span className="text-muted-foreground">تماس با ما</span><span className="text-muted-foreground">فرصت‌های شغلی</span><span className="text-muted-foreground">اخبار</span></div></div><p className="landing-copyright">کلیه حقوق محفوظ است © ۱۴۰۳ کارنکس</p></footer>
    </main>
  );
}
