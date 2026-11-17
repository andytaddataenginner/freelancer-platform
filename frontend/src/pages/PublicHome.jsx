import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Cloud, Database, Download, Github, Linkedin, Mail, Moon, Sun, ExternalLink, Menu, X, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiBaseUrl } from '../services/api';

const ASSETS = '/';
const skills = [
  ['SQL Server & T-SQL',98],['Power BI & Data Visualization',95],['Data Warehouse Design',92],['Database Performance Tuning',90],
  ['Azure Data Platform',88],['Microsoft Fabric',85],['Python for Data Engineering',82],['Databricks & Snowflake',80]
];
const services = [
  {icon:BarChart3,title:'Business Intelligence & Analytics',copy:'Transform raw data into actionable insights with interactive Power BI dashboards, KPI reporting, data modeling and advanced analytics.'},
  {icon:Database,title:'Data Engineering & ETL',copy:'Design reliable data pipelines, data warehouses and ETL processes using SQL Server, Python, dbt and modern data platforms.'},
  {icon:Cloud,title:'Cloud & Modern Data Platforms',copy:'Build and modernize scalable solutions across Azure, Microsoft Fabric, Databricks and Snowflake.'},
  {icon:CheckCircle2,title:'Automation & Consulting',copy:'Improve data operations through workflow automation, database performance tuning, architecture guidance and ongoing technical support.'}
];
const demoPortfolio = [
  {emoji:'📊',category:'Business Intelligence',title:'Sales Analytics Dashboard',description:'Interactive reporting that brings sales performance, trends and regional KPIs into one decision-ready view.'},
  {emoji:'🗄️',category:'Data Engineering',title:'Enterprise Data Warehouse',description:'A centralized analytics foundation integrating multiple business data sources into trusted reporting models.'},
  {emoji:'☁️',category:'Cloud Migration',title:'Cloud Data Modernization',description:'Modernized data workloads and reporting foundations for scalable cloud-based analytics.'}
];

export function PublicHome() {
  const scrollTo=(id)=>event=>{event.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});};
  const [portfolio,setPortfolio]=useState(demoPortfolio);
  const [theme,setTheme]=useState(()=>localStorage.getItem('qfa_theme')||'light');
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [form,setForm]=useState({name:'',email:'',service:'',message:''});
  const [sending,setSending]=useState(false);
  const [status,setStatus]=useState({type:'',message:''});
  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('qfa_theme',theme);},[theme]);
  useEffect(()=>{
    let active=true;
    fetch(apiBaseUrl+'/portfolio').then(r=>{if(!r.ok)throw new Error('Portfolio unavailable');return r.json();})
      .then(items=>{if(active&&Array.isArray(items)&&items.length)setPortfolio(items);})
      .catch(()=>{});
    return()=>{active=false;};
  },[]);
  async function submitContact(e){
    e.preventDefault();setSending(true);setStatus({type:'',message:''});
    try{
      const message=(form.service?'Service interested in: '+form.service+'\n\n':'')+form.message;
      const response=await fetch(apiBaseUrl+'/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.name,email:form.email,message})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Unable to send your message.');
      setStatus({type:'success',message:'Message received. We will get back to you within 24 hours.'});
      setForm({name:'',email:'',service:'',message:''});
    }catch(error){setStatus({type:'error',message:error.message+' You can also email ndy.andupa@gmail.com directly.'});}
    finally{setSending(false);}
  }
  return <main className="public-home">
    <nav className={"public-nav"+(mobileMenuOpen?" public-nav-open":"")}>
      <a className="public-brand" href="#top" onClick={scrollTo('top')}><img src={ASSETS+'QFA_Logo.png'} alt="QFA logo"/><span>Quick Freelancing Agency</span></a>
      <Link className="public-mobile-login" to="/login?role=freelancer">Log in</Link>
      <button className="public-mobile-menu" aria-label={mobileMenuOpen?"Close navigation":"Open navigation"} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(v=>!v)}>{mobileMenuOpen?<X size={21}/>:<Menu size={21}/>}</button>
      <div className="public-nav-links"><a href="#work" onClick={e=>{scrollTo('work')(e);setMobileMenuOpen(false);}}>Our work</a><a href="#skills" onClick={e=>{scrollTo('skills')(e);setMobileMenuOpen(false);}}>Expertise</a><a href="#resume" onClick={e=>{scrollTo('resume')(e);setMobileMenuOpen(false);}}>Resume</a><a href="#services" onClick={e=>{scrollTo('services')(e);setMobileMenuOpen(false);}}>Services</a><a href="#contact" onClick={e=>{scrollTo('contact')(e);setMobileMenuOpen(false);}}>Contact</a><button className="public-theme-toggle" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} aria-label="Toggle colour theme">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><Link className="public-login-link" to="/login?role=freelancer" onClick={()=>setMobileMenuOpen(false)}>Freelancer Login</Link><Link className="public-login-link" to="/login?mode=signup" onClick={()=>setMobileMenuOpen(false)}>Create Account</Link><Link className="public-login-link" to="/login?role=client" onClick={()=>setMobileMenuOpen(false)}>Client Login <ArrowRight size={15}/></Link></div>
    </nav>
    <header className="public-hero" id="top">
      <div className="public-hero-copy">
        <div className="public-eyebrow"><span/> OPEN FOR SELECT PROJECTS</div>
        <h1>Data, <em>analytics</em><br/>and digital solutions.</h1>
        <p>We turn data into business value through analytics, reporting, cloud technologies, automation and dependable data engineering.</p>
        <div className="public-hero-actions"><a className="public-btn-primary" href="#contact" onClick={scrollTo('contact')}>Start a project <ArrowRight size={17}/></a><a className="public-btn-ghost" href="#work" onClick={scrollTo('work')}>Explore our work</a></div>
        <div className="public-proof"><span>End-to-end delivery</span><i>•</i><span>Modern data platforms</span><i>•</i><span>Business-focused analytics</span></div>
        <div className="public-stats"><div><strong>7+</strong><span>Years of experience</span></div><div><strong>50+</strong><span>Client engagements</span></div><div><strong>60+</strong><span>Projects delivered</span></div></div>
      </div>
      <div className="public-founder-card">
        <div className="founder-accent"/>
        <img className="founder-photo" src={ASSETS+'anduamlak.png'} alt="Anduamlak Tadesse"/>
        <h2>Anduamlak Tadesse</h2><div className="founder-role">FOUNDER & CEO</div>
        <p>Senior Data Engineer and BI professional focused on building reliable data platforms, practical analytics and solutions that create measurable business value.</p>
        <div className="founder-skills"><span>SQL Server</span><span>Power BI</span><span>Azure</span><span>Microsoft Fabric</span><span>Databricks</span><span>Snowflake</span><span>Python</span><span>Data Warehousing</span></div>
        <div className="founder-links"><a href="https://www.linkedin.com/in/anduamlak-tadesse-bb8bab215" target="_blank" rel="noreferrer"><Linkedin size={16}/> LinkedIn</a><a href="https://wa.me/251911859866" target="_blank" rel="noreferrer">WhatsApp</a><a href="mailto:ndy.andupa@gmail.com"><Mail size={16}/> Email</a></div>
      </div>
    </header>
    <section className="public-skills" id="skills"><div className="public-section-inner"><div className="public-eyebrow">OUR EXPERTISE</div><h2>Core technical skills</h2><p className="public-section-intro">Hands-on capability across the modern data stack, from source systems to business-ready insights.</p><div className="public-skill-grid">{skills.map(([name,value])=><div className="public-skill" key={name}><div><strong>{name}</strong><span>{value}%</span></div><div className="public-skill-track"><i style={{width:value+'%'}}/></div></div>)}</div></div></section>
    <section className="public-resume" id="resume"><div className="public-resume-inner"><div><div className="public-eyebrow">EXPERIENCE & CREDENTIALS</div><h2>The experience<br/>behind the work.</h2><p className="public-resume-copy">Helping businesses turn data into decisions through freelance data engineering, business intelligence and analytics solutions, backed by a strong Computer Science foundation.</p><div className="public-highlights"><div><b>🎓</b><p><strong>Computer Science foundation</strong><span>Master’s and Bachelor’s education in Computer Science.</span></p></div><div><b>🛠️</b><p><strong>Full-stack data expertise</strong><span>Power BI, SQL Server, Microsoft Fabric, Azure, Databricks, Snowflake and Python.</span></p></div><div><b>🚀</b><p><strong>End-to-end delivery</strong><span>Freelance projects spanning data integration, cloud platforms, database optimization and executive reporting.</span></p></div></div><div className="public-resume-actions"><a className="public-btn-gold" href={ASSETS+'Anduamlak_Tadesse_Resume.pdf'} download><Download size={17}/> Download resume (PDF)</a><a className="public-btn-ghost" href={ASSETS+'Anduamlak_Tadesse_Resume.pdf'} target="_blank" rel="noreferrer">Preview resume <ExternalLink size={15}/></a></div></div><a className="public-resume-preview" href={ASSETS+'Anduamlak_Tadesse_Resume.pdf'} target="_blank" rel="noreferrer"><span>PDF RESUME</span><img src={ASSETS+'resume-preview.jpg'} alt="Resume preview"/><small>Anduamlak Tadesse · Resume</small></a></div></section>
    <section className="public-portfolio" id="work"><div className="public-section-inner"><div className="public-eyebrow">SELECTED WORK</div><h2>Practical work. Real outcomes.</h2><p className="public-section-intro">A selection of freelance and consulting deliverables across BI dashboards, data pipelines and cloud modernization.</p><div className="public-portfolio-grid">{portfolio.map((item,i)=><article className="public-portfolio-card" key={item.id||item.title||i}>{item.image_url?<img className="portfolio-image" src={item.image_url} alt={item.title}/>:<div className="portfolio-placeholder">{item.emoji||'💻'}</div>}<div className="public-portfolio-body"><div className="public-card-category">{item.category||item.cat||'Project'}</div><h3>{item.title}</h3><p>{item.description||item.desc||''}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">View project <ArrowRight size={14}/></a>}</div></article>)}</div></div></section>
    <section className="public-services" id="services"><div className="public-section-inner"><div className="public-eyebrow">WHAT WE DO</div><h2>Services built around your goals.</h2><div className="public-service-grid">{services.map(({icon:Icon,title,copy})=><article className="public-service-card" key={title}><div><Icon size={22}/></div><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <section className="public-contact" id="contact"><div className="public-contact-inner"><div className="public-contact-info"><div className="public-eyebrow">LET’S WORK TOGETHER</div><h2>Have a data challenge?<br/><em>Let’s talk.</em></h2><p>Tell us what you are working on. We’ll review your requirements and get back to you within 24 hours.</p><a href="mailto:ndy.andupa@gmail.com"><span><Mail size={19}/></span><div><strong>Email</strong><small>ndy.andupa@gmail.com</small></div></a><a href="https://wa.me/251911859866" target="_blank" rel="noreferrer"><span>✆</span><div><strong>WhatsApp</strong><small>+251 911 859 866</small></div></a><a href="https://www.linkedin.com/in/anduamlak-tadesse-bb8bab215" target="_blank" rel="noreferrer"><span><Linkedin size={19}/></span><div><strong>LinkedIn</strong><small>Anduamlak Tadesse</small></div></a></div>
      <form className="public-contact-form" onSubmit={submitContact}><div className="public-form-row"><label>Your name<input required maxLength="120" autoComplete="name" value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Your full name"/></label><label>Email address<input type="email" required maxLength="254" autoComplete="email" value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} placeholder="you@example.com"/></label></div><label>Service interested in<select value={form.service} onChange={e=>setForm(x=>({...x,service:e.target.value}))}><option value="">Select a service</option><option>Business Intelligence & Analytics</option><option>Data Engineering & ETL</option><option>Cloud & Modern Data Platforms</option><option>Automation & Consulting</option><option>Other</option></select></label><label>Tell us about your project<textarea required minLength="10" maxLength="5000" rows="5" value={form.message} onChange={e=>setForm(x=>({...x,message:e.target.value}))} placeholder="Describe your project, goals or challenge…"/></label><button className="public-btn-primary" disabled={sending}>{sending?'Sending message…':'Send message'} <ArrowRight size={16}/></button>{status.message&&<p className={'public-form-status '+status.type} role="status">{status.message}</p>}</form>
    </div></section>
    <footer className="public-footer"><div className="public-footer-brand"><img src={ASSETS+'QFA_Logo.png'} alt="QFA"/><div><strong>Quick Freelancing Agency</strong><small>DATA & ANALYTICS</small></div></div><div className="public-footer-links"><a href="#work" onClick={scrollTo('work')}>Portfolio</a><a href="#resume" onClick={scrollTo('resume')}>Resume</a><a href="https://github.com/andytaddataenginner" target="_blank" rel="noreferrer">GitHub</a><a href="https://www.linkedin.com/in/anduamlak-tadesse-bb8bab215" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://wa.me/251911859866" target="_blank" rel="noreferrer">WhatsApp</a></div><span>© {new Date().getFullYear()} Quick Freelancing Agency. All rights reserved.</span></footer>
  </main>;
}