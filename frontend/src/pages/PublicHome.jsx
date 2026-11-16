import { ArrowRight, BarChart3, Cloud, Database, Github, Linkedin, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const services = [
  { icon: BarChart3, title: 'Business Intelligence', copy: 'Power BI reporting, analytics, data modeling and actionable business insights.' },
  { icon: Database, title: 'Data Engineering', copy: 'Reliable data pipelines, SQL development, warehouse design and modernization.' },
  { icon: Cloud, title: 'Cloud & Modern Data', copy: 'Azure, Microsoft Fabric, Databricks and scalable cloud data solutions.' },
];

export function PublicHome() {
  return (
    <main className="public-home">
      <nav className="public-nav"><Link className="public-brand" to="/"><span>Q</span> Quick Freelancing Agency</Link><div><a href="#services">Services</a><a href="#about">About</a><Link className="nav-portal" to="/login">Client & Team Portal <ArrowRight size={15}/></Link></div></nav>
      <section className="public-hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> DATA · ANALYTICS · ENGINEERING</div><h1>Turn your data into <em>decisions.</em></h1><p>Practical data engineering and analytics solutions that help businesses build reliable data foundations and make confident decisions.</p><div className="hero-actions"><a className="button-primary" href="mailto:ndy.andupa@gmail.com">Discuss a project <ArrowRight size={17}/></a><a className="button-secondary" href="#services">Explore services</a></div><div className="hero-proof"><span>End-to-end delivery</span><span>•</span><span>Modern data platforms</span><span>•</span><span>Business-focused analytics</span></div></div>
        <div className="hero-art"><div className="art-glow"/><div className="analytics-card"><div className="analytics-top"><span>DATA THAT WORKS</span><span className="live-dot">● LIVE</span></div><div className="analytics-title">From raw data<br/>to clear direction.</div><div className="chart-bars">{[35,55,43,72,58,88,68,100,78,92,72,110].map((h,i)=><i key={i} style={{height:h}}/>)}</div><div className="analytics-foot"><span>ENGINEERING</span><span>INSIGHTS</span><span>IMPACT</span></div></div><div className="floating-chip chip-one">✦ Modern data stack</div><div className="floating-chip chip-two">Power BI · Fabric · SQL</div></div>
      </section>
      <section id="services" className="public-services"><div className="section-heading"><div className="eyebrow">WHAT WE DO</div><h2>Technology that moves<br/>your business forward.</h2></div><div className="service-grid">{services.map(({icon:Icon,title,copy})=><article className="service-card" key={title}><div className="service-icon"><Icon size={22}/></div><h3>{title}</h3><p>{copy}</p><ArrowRight className="service-arrow" size={18}/></article>)}</div></section>
      <section id="about" className="public-about"><div><div className="eyebrow">ABOUT QFA</div><h2>Practical expertise.<br/><em>Measurable outcomes.</em></h2></div><p>Quick Freelancing Agency delivers freelance data and analytics services with a focus on quality engineering, clear reporting and dependable execution.</p></section>
      <footer className="public-footer"><div><strong>QFA</strong><span>Quick Freelancing Agency · Data & Analytics</span></div><div className="footer-links"><a href="https://github.com/andytaddataenginner" aria-label="GitHub"><Github size={18}/></a><a href="https://www.linkedin.com/in/anduamlak-tadesse-bb8bab215" aria-label="LinkedIn"><Linkedin size={18}/></a><a href="mailto:ndy.andupa@gmail.com" aria-label="Email"><Mail size={18}/></a></div><span>© {new Date().getFullYear()} QFA. All rights reserved.</span></footer>
    </main>
  );
}