import React, { useState, useEffect } from 'react';
import { 
  BarChart as BarIcon, LineChart as LineIcon, Table as TableIcon, PieChart as PieIcon, Map as MapIcon, 
  Settings, Send, Clock, AlertTriangle, BookOpen, Eye, Maximize2,
  CheckCircle2, ChevronRight, RefreshCw, Trophy, FileText, Layout, ArrowRight, XCircle, ArrowLeft, LogOut
} from 'lucide-react';

// Intercept JWT Token from Dashboard if it exists in URL params
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
const taskFromUrl = urlParams.get('task');
const writingTaskFromUrl = urlParams.get('writingTask');
const sessionIdFromUrl = urlParams.get('sessionId') || sessionStorage.getItem('writingSessionId') || null; // New parameter: 'task1', 'task2', or 'both'
const forcedWritingTask = writingTaskFromUrl === 'both' ? 'both' 
  : writingTaskFromUrl === 'task2' ? 'task2' 
  : writingTaskFromUrl === 'task1' ? 'task1'
  : taskFromUrl === '2' ? 'task2' 
  : taskFromUrl === '1' ? 'task1' 
  : null;
if (tokenFromUrl) {
  localStorage.setItem('token', tokenFromUrl);
}

let initialTaskMeta = null;
const taskMetaFromUrl = urlParams.get('taskMeta');
if (taskMetaFromUrl) {
  try {
    initialTaskMeta = JSON.parse(decodeURIComponent(taskMetaFromUrl));
  } catch(e) { console.error('Failed to parse taskMeta'); }
}

if (tokenFromUrl || taskMetaFromUrl) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

// ── Institution Branding ──────────────────────────────────────────────────────
const _hexToRgb = (hex) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)}, ${parseInt(r[2],16)}, ${parseInt(r[3],16)}` : '128, 0, 32';
};
const _darkenHex = (hex, pct = 0.4) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '#1a0008';
  return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)].map(v=>Math.round(v*(1-pct)).toString(16).padStart(2,'0')).join('')}`;
};
const _branding = (() => { try { return JSON.parse(localStorage.getItem('branding') || '{}'); } catch { return {}; } })();
const BRAND_PRIMARY   = _branding.primary_color   || '#800020';
const BRAND_SECONDARY = _branding.secondary_color || '#F7E7CE';
const BRAND_DARK      = _darkenHex(BRAND_PRIMARY);
const BRAND_LOGO_URL  = _branding.logo_url || null;
const BRAND_WELCOME   = _branding.welcome_text || 'IELTS Master';
document.documentElement.style.setProperty('--brand-primary-rgb', _hexToRgb(BRAND_PRIMARY));
document.documentElement.style.setProperty('--brand-primary',     BRAND_PRIMARY);
document.documentElement.style.setProperty('--brand-secondary',   BRAND_SECONDARY);
// ─────────────────────────────────────────────────────────────────────────────

const TASK_1_PROMPTS = [
  {
    id: 1,
    type: "Bar Chart",
    title: "University Enrollment by Faculty",
    instruction: "The bar chart below shows the number of students enrolled in five different faculties at a UK university in 2010, 2015, and 2020.",
    data: [
      { label: 'Arts', v1: 4200, v2: 3800, v3: 3400 },
      { label: 'Science', v1: 2800, v2: 4100, v3: 5500 },
      { label: 'Law', v1: 1100, v2: 1350, v3: 1800 },
      { label: 'Business', v1: 4500, v2: 5000, v3: 4800 },
      { label: 'Eng.', v1: 1900, v2: 3100, v3: 4200 }
    ],
    labels: { legend1: "2010", legend2: "2015", legend3: "2020", yUnit: "Students" },
    graphic: "bar"
  },
  {
    id: 2,
    type: "Line Graph",
    title: "Household Energy Consumption",
    instruction: "The graph shows the average weekly energy consumption (in kWh) of a typical household in Australia between 2000 and 2020.",
    data: [
      { year: '2000', v1: 40, v2: 10, v3: 20 },
      { year: '2005', v1: 50, v2: 20, v3: 18 },
      { year: '2010', v1: 50, v2: 30, v3: 15 },
      { year: '2015', v1: 45, v2: 42, v3: 10 },
      { year: '2020', v1: 30, v2: 50, v3: 6 }
    ],
    labels: { l1: "Heating", l2: "Cooling", l3: "Lighting", yUnit: "Energy (kWh)" },
    graphic: "line"
  },
  {
    id: 3,
    type: "Table",
    title: "World Coffee Production",
    instruction: "The table shows the amount of coffee produced (in millions of tonnes) in four different countries in 2005, 2010, and 2020.",
    data: [
      { country: 'Brazil', y1: 1.9, y2: 2.5, y3: 3.8 },
      { country: 'Vietnam', y1: 0.7, y2: 1.2, y3: 1.8 },
      { country: 'Colombia', y1: 0.7, y2: 0.8, y3: 0.9 },
      { country: 'Indonesia', y1: 0.5, y2: 0.6, y3: 0.7 }
    ],
    headers: ["Country", "2005 (m/t)", "2010 (m/t)", "2020 (m/t)"],
    graphic: "table"
  },
  {
    id: 4,
    type: "Mixed Charts",
    title: "Leisure Activities in Japan",
    instruction: "The pie charts compare how young adults in Japan distributed their leisure time in 2004 and 2019.",
    graphic: "mixed",
    panels: [
      {
        title: "2004",
        graphic: "pie",
        data: [
          { label: 'Video Games', value: 45, color: '#3b82f6' },
          { label: 'Socializing', value: 25, color: '#ef4444' },
          { label: 'Sports', value: 20, color: '#10b981' },
          { label: 'Reading', value: 10, color: '#f59e0b' }
        ]
      },
      {
        title: "2019",
        graphic: "pie",
        data: [
          { label: 'Video Games', value: 65, color: '#3b82f6' },
          { label: 'Socializing', value: 15, color: '#ef4444' },
          { label: 'Sports', value: 15, color: '#10b981' },
          { label: 'Reading', value: 5, color: '#f59e0b' }
        ]
      }
    ]
  },
  {
    id: 5,
    type: "Process",
    title: "Recycling Glass Bottles",
    instruction: "The diagram illustrates the stages involved in the glass bottle recycling process.",
    data: [
      "Collection Point", "Sorting by Color", "Crushing (Cullet)", "Furnace (Melting)", "Molding New Bottles"
    ],
    graphic: "process"
  },
  {
    id: 6,
    type: "Bar Chart",
    title: "Internet Access in Schools by Region",
    instruction: "The bar chart compares the number of internet-connected computers per 1,000 students in five regions in 2000, 2010, and 2020.",
    data: [
      { label: 'Europe', v1: 80, v2: 200, v3: 340 },
      { label: 'N.Am.', v1: 120, v2: 260, v3: 380 },
      { label: 'Asia', v1: 30, v2: 140, v3: 280 },
      { label: 'S.Am.', v1: 45, v2: 155, v3: 240 },
      { label: 'Africa', v1: 10, v2: 70, v3: 140 }
    ],
    labels: { legend1: "2000", legend2: "2010", legend3: "2020", yUnit: "Computers per 1,000" },
    graphic: "bar"
  },
  {
    id: 7,
    type: "Line Graph",
    title: "Global Temperatures",
    instruction: "The graph shows changes in global surface temperatures relative to the average from 1880 to 2020.",
    data: [
      { year: '1880', v1: -0.15, v2: -0.20, v3: -0.18 },
      { year: '1920', v1: -0.10, v2: -0.05, v3: -0.08 },
      { year: '1960', v1: 0.10, v2: -0.10, v3: 0.00 },
      { year: '1980', v1: 0.30, v2: 0.08, v3: 0.20 },
      { year: '2000', v1: 0.60, v2: 0.35, v3: 0.50 },
      { year: '2020', v1: 1.10, v2: 0.70, v3: 0.90 }
    ],
    labels: { l1: "Land", l2: "Ocean", l3: "Global Avg", yUnit: "Temp. anomaly (°C)" },
    graphic: "line"
  },
  { id: 8, type: "Mixed Charts", title: "Global Energy Consumption by Fuel Type", instruction: "The pie charts compare the world's energy consumption by fuel type in 1998 and 2018.", graphic: "mixed", panels: [{ title: "1998", graphic: "pie", data: [{ label: 'Oil', value: 38, color: '#3366cc' }, { label: 'Coal', value: 23, color: '#dc3912' }, { label: 'Gas', value: 22, color: '#ff9900' }, { label: 'Nuclear', value: 6, color: '#109618' }, { label: 'Renewables', value: 11, color: '#990099' }] }, { title: "2018", graphic: "pie", data: [{ label: 'Oil', value: 33, color: '#3366cc' }, { label: 'Coal', value: 27, color: '#dc3912' }, { label: 'Gas', value: 24, color: '#ff9900' }, { label: 'Nuclear', value: 4, color: '#109618' }, { label: 'Renewables', value: 12, color: '#990099' }] }] },
  { id: 9, type: "Table", title: "Mobile Phone Ownership", instruction: "The table shows the percentage of people owning a mobile phone in five countries in 2005, 2010, and 2015.", data: [{ country: 'USA', y1: 74, y2: 85, y3: 92 }, { country: 'UK', y1: 70, y2: 82, y3: 90 }, { country: 'China', y1: 32, y2: 65, y3: 88 }, { country: 'India', y1: 12, y2: 40, y3: 72 }, { country: 'Brazil', y1: 28, y2: 55, y3: 80 }], headers: ["Country", "2005 (%)", "2010 (%)", "2015 (%)"], graphic: "table" },
  { id: 10, type: "Line Graph", title: "Unemployment Rates", instruction: "The graph shows unemployment rates in the USA, Japan, and Germany between 2000 and 2010.", data: [{ year: '2000', v1: 4.0, v2: 4.8, v3: 7.9 }, { year: '2002', v1: 5.8, v2: 5.4, v3: 8.7 }, { year: '2004', v1: 5.5, v2: 4.7, v3: 10.5 }, { year: '2006', v1: 4.6, v2: 4.1, v3: 9.8 }, { year: '2008', v1: 5.8, v2: 4.0, v3: 7.5 }, { year: '2010', v1: 9.6, v2: 5.1, v3: 7.0 }], labels: { l1: "USA", l2: "Japan", l3: "Germany", yUnit: "Unemployment Rate (%)" }, graphic: "line" },
  { id: 11, type: "Process", title: "Drinking Water Purification", instruction: "The diagram shows how river water is treated and distributed as safe drinking water to households.", data: ["River Intake", "Screening (Remove Debris)", "Sedimentation Tank", "Chemical Treatment", "Sand & Carbon Filtration", "Chlorine Disinfection", "Storage Reservoir", "Household Supply"], graphic: "process" },
  { id: 12, type: "Bar Chart", title: "Cinema Attendance by Age Group", instruction: "The bar chart shows the percentage of people who attended the cinema at least once a month in five age groups in 2007, 2012, and 2017.", data: [{ label: '14-24', v1: 55, v2: 50, v3: 42 }, { label: '25-34', v1: 28, v2: 32, v3: 36 }, { label: '35-44', v1: 18, v2: 20, v3: 26 }, { label: '45-54', v1: 12, v2: 14, v3: 18 }, { label: '55+', v1: 7, v2: 9, v3: 13 }], labels: { legend1: "2007", legend2: "2012", legend3: "2017", yUnit: "% attending monthly" }, graphic: "bar" },
  { id: 13, type: "Table", title: "International Student Numbers", instruction: "The table shows the number of international students (thousands) in four countries in 1990, 2000, and 2010.", data: [{ country: 'USA', y1: 300, y2: 450, y3: 600 }, { country: 'UK', y1: 150, y2: 270, y3: 400 }, { country: 'Australia', y1: 50, y2: 130, y3: 250 }, { country: 'Canada', y1: 40, y2: 110, y3: 200 }], headers: ["Country", "1990 (000s)", "2000 (000s)", "2010 (000s)"], graphic: "table" },
  { id: 14, type: "Mixed Charts", title: "Water Consumption by Sector", instruction: "The pie charts compare how total water consumption was distributed across five sectors in a developed country in 2002 and 2022.", graphic: "mixed", panels: [{ title: "2002", graphic: "pie", data: [{ label: 'Agriculture', value: 53, color: '#22c55e' }, { label: 'Industry', value: 20, color: '#3b82f6' }, { label: 'Domestic', value: 15, color: '#ef4444' }, { label: 'Energy', value: 8, color: '#f59e0b' }, { label: 'Public Svcs', value: 4, color: '#8b5cf6' }] }, { title: "2022", graphic: "pie", data: [{ label: 'Agriculture', value: 42, color: '#22c55e' }, { label: 'Industry', value: 23, color: '#3b82f6' }, { label: 'Domestic', value: 18, color: '#ef4444' }, { label: 'Energy', value: 9, color: '#f59e0b' }, { label: 'Public Svcs', value: 8, color: '#8b5cf6' }] }] },
  { id: 15, type: "Line Graph", title: "Metals Prices in Global Markets", instruction: "The line graph compares average monthly prices of gold, silver and copper between 2020 and 2024.", data: [{ year: '2020', v1: 2300, v2: 16, v3: 3.1 }, { year: '2021', v1: 2050, v2: 24, v3: 4.6 }, { year: '2022', v1: 1680, v2: 41, v3: 2.9 }, { year: '2023', v1: 1210, v2: 19, v3: 5.4 }, { year: '2024', v1: 980, v2: 47, v3: 3.3 }], labels: { l1: "Gold (USD/oz)", l2: "Silver (USD/oz)", l3: "Copper (USD/lb)", yUnit: "Price (USD)" }, graphic: "line" },
  { id: 16, type: "Process", title: "Paper Recycling", instruction: "The diagram shows the process of recycling paper.", data: ["Waste Collection", "De-inking", "Pulping", "Rolling", "Drying", "New Paper"], graphic: "process" },
  { id: 17, type: "Bar Chart", title: "Fruit Consumption", instruction: "The chart shows the average daily fruit consumption of adults in five different cities. The blue bars represent males, and the red bars represent females.", data: [{ label: 'City A', v1: 1.2, v2: 1.5 }, { label: 'City B', v1: 0.8, v2: 1.1 }, { label: 'City C', v1: 2.1, v2: 2.3 }, { label: 'City D', v1: 1.5, v2: 1.8 }, { label: 'City E', v1: 1.0, v2: 1.2 }], labels: { legend1: "Male", legend2: "Female", yUnit: "Portions" }, graphic: "bar" },
  { id: 18, type: "Table", title: "Urbanization Rates", instruction: "The table shows the percentage of the population living in urban areas in four world regions in 1990, 2000, and 2020.", data: [{ country: 'Africa', y1: 28, y2: 36, y3: 44 }, { country: 'Asia', y1: 32, y2: 40, y3: 52 }, { country: 'Europe', y1: 68, y2: 71, y3: 76 }, { country: 'N. America', y1: 73, y2: 77, y3: 83 }], headers: ["Region", "1990 (%)", "2000 (%)", "2020 (%)"], graphic: "table" },
  { id: 19, type: "Mixed Charts", title: "Student Accommodation Preferences", instruction: "The pie charts compare the preferred housing options of international students in a UK city in 2013 and 2023.", graphic: "mixed", panels: [{ title: "2013", graphic: "pie", data: [{ label: 'Uni Halls', value: 48, color: '#6366f1' }, { label: 'Private Rental', value: 22, color: '#ec4899' }, { label: 'Shared Flat', value: 14, color: '#06b6d4' }, { label: 'Homestay', value: 11, color: '#f59e0b' }, { label: 'Other', value: 5, color: '#94a3b8' }] }, { title: "2023", graphic: "pie", data: [{ label: 'Uni Halls', value: 34, color: '#6366f1' }, { label: 'Private Rental', value: 29, color: '#ec4899' }, { label: 'Shared Flat', value: 19, color: '#06b6d4' }, { label: 'Homestay', value: 12, color: '#f59e0b' }, { label: 'Other', value: 6, color: '#94a3b8' }] }] },
  { id: 20, type: "Line Graph", title: "Average Life Expectancy", instruction: "The line graph shows changes in average life expectancy (in years) in Japan, Brazil, and Nigeria between 1960 and 2020.", data: [{ year: '1960', v1: 67, v2: 54, v3: 40 }, { year: '1975', v1: 73, v2: 59, v3: 43 }, { year: '1990', v1: 79, v2: 66, v3: 46 }, { year: '2000', v1: 81, v2: 70, v3: 50 }, { year: '2010', v1: 83, v2: 73, v3: 54 }, { year: '2020', v1: 84, v2: 75, v3: 63 }], labels: { l1: "Japan", l2: "Brazil", l3: "Nigeria", yUnit: "Life Expectancy (years)" }, graphic: "line" },
  {
    id: 21,
    type: "Mixed Charts",
    title: "Transport Spending vs Commuter Modes",
    instruction: "The graphics compare city transport spending in 2018 and 2023 and show commuter mode share in 2023.",
    graphic: "mixed",
    panels: [
      {
        title: "Annual Transport Spending (USD millions)",
        graphic: "bar",
        labels: { legend1: "2018", legend2: "2023" },
        data: [
          { label: 'Roads', v1: 420, v2: 360 },
          { label: 'Rail', v1: 180, v2: 340 },
          { label: 'Buses', v1: 120, v2: 190 },
          { label: 'Cycling', v1: 45, v2: 110 }
        ]
      },
      {
        title: "Commuter Mode Share (2023)",
        graphic: "pie",
        data: [
          { label: 'Private Car', value: 38, color: '#64748b' },
          { label: 'Rail', value: 27, color: '#2563eb' },
          { label: 'Bus', value: 21, color: '#0ea5e9' },
          { label: 'Cycling/Walk', value: 14, color: '#10b981' }
        ]
      }
    ]
  },
  {
    id: 22,
    type: "Mixed Charts",
    title: "Study Habits and Exam Outcomes",
    instruction: "The bar chart shows weekly study hours by faculty, while the pie chart illustrates grade distribution for the same cohort.",
    graphic: "mixed",
    panels: [
      {
        title: "Average Weekly Study Hours",
        graphic: "bar",
        labels: { legend1: "Year 1", legend2: "Year 3" },
        data: [
          { label: 'Engineering', v1: 11, v2: 17 },
          { label: 'Business', v1: 8, v2: 12 },
          { label: 'Law', v1: 10, v2: 15 },
          { label: 'Arts', v1: 7, v2: 9 }
        ]
      },
      {
        title: "Final Grade Distribution",
        graphic: "pie",
        data: [
          { label: 'A', value: 18, color: '#22c55e' },
          { label: 'B', value: 36, color: '#3b82f6' },
          { label: 'C', value: 31, color: '#f59e0b' },
          { label: 'D or below', value: 15, color: '#ef4444' }
        ]
      }
    ]
  }
];

const TASK_2_PROMPTS = [
  {
    id: 101,
    type: "Agree/Disagree",
    title: "University Education Should Be Free",
    instruction: "Some people believe that university education should be free for everyone. To what extent do you agree or disagree?"
  },
  {
    id: 102,
    type: "Discuss Both Views",
    title: "Online vs Face-to-Face Learning",
    instruction: "Some people think online learning is more effective, while others believe face-to-face classes are better. Discuss both views and give your own opinion."
  },
  {
    id: 103,
    type: "Problem/Solution",
    title: "Traffic Congestion in Cities",
    instruction: "In many cities, traffic congestion is becoming worse. What are the main causes of this problem and what solutions can be suggested?"
  },
  {
    id: 104,
    type: "Advantages/Disadvantages",
    title: "Working From Home",
    instruction: "More people are working from home rather than going to an office every day. Do the advantages of this development outweigh the disadvantages?"
  },
  {
    id: 105,
    type: "Double Question",
    title: "Children and Screen Time",
    instruction: "Children today spend long hours using smartphones and tablets. Why is this happening, and is this a positive or negative development?"
  },
  {
    id: 106,
    type: "Discuss Both Views",
    title: "Public vs Private Healthcare",
    instruction: "Some people believe healthcare should be funded entirely by governments, while others think individuals should pay for their own care. Discuss both views and give your opinion."
  },
  {
    id: 107,
    type: "Problem/Solution",
    title: "Teacher Burnout",
    instruction: "Many schools are reporting high levels of teacher burnout. What are the main causes, and what measures could reduce this problem?"
  },
  {
    id: 108,
    type: "Agree/Disagree",
    title: "AI in Education",
    instruction: "Artificial intelligence should play a major role in secondary education. To what extent do you agree or disagree?"
  },
  {
    id: 109,
    type: "Advantages/Disadvantages",
    title: "Gap Year Before University",
    instruction: "An increasing number of students take a gap year before starting university. Do the advantages outweigh the disadvantages?"
  },
  {
    id: 110,
    type: "Double Question",
    title: "Urban Green Spaces",
    instruction: "Many cities are replacing old buildings with parks and green spaces. Why is this happening, and how does this trend affect city residents?"
  }
];

const TASK_INSTRUCTIONS = {
  task1: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
  task2: 'Write about the following topic... Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 100 words.'
};

const GRAMMAR_LAB_MAP = {
  "Article Usage": "01_article_usage",
  "Countability & Plurals": "02_countability_and_plurals",
  "Pronoun Reference": "03_pronoun_reference",
  "Prepositional Accuracy": "04_prepositional_accuracy",
  "Word Forms": "05_word_forms",
  "Subject-Verb Agreement": "06_subject_verb_agreement",
  "Tense Consistency": "07_tense_consistency",
  "Present Perfect vs. Past Simple": "08_present_perfect_vs_past_simple",
  "Gerunds vs. Infinitives": "09_gerunds_vs_infinitives",
  "Passive Voice Construction": "10_passive_voice_construction",
  "Sentence Boundaries (Fragments/Comma Splices)": "11_sentence_boundaries",
  "Relative Clauses": "12_relative_clauses",
  "Subordination": "13_subordination",
  "Word Order": "14_word_order",
  "Parallel Structure": "15_parallel_structure",
  "Transitional Devices": "16_transitional_devices",
  "Collocations": "17_collocations",
  "Academic Register": "18_academic_register",
  "Nominalization": "19_nominalization",
  "Hedging": "20_hedging"
};

const VisualRenderer = ({ prompt }) => {
  if (prompt.graphic === 'bar') {
    const maxVal = Math.max(...prompt.data.flatMap(d => [d.v1, d.v2]), 1) * 1.1;
    return (
      <div className="w-full h-full p-6">
        <svg viewBox="0 0 340 220" className="w-full h-full">
          {/* Y-axis */}
          <line x1="40" y1="10" x2="40" y2="160" stroke="#64748b" strokeWidth="2" />
          {/* X-axis */}
          <line x1="40" y1="160" x2="320" y2="160" stroke="#64748b" strokeWidth="2" />
          
          {/* Y-axis label */}
          <text x="15" y="85" fontSize="11" fill="#1e293b" fontWeight="bold" transform="rotate(-90 15 85)" textAnchor="middle">{prompt.labels?.yUnit || "Value"}</text>
          
          {/* Y-axis scale markers */}
          <text x="35" y="15" fontSize="9" textAnchor="end" fill="#64748b">{Math.round(maxVal)}</text>
          <text x="35" y="88" fontSize="9" textAnchor="end" fill="#64748b">{Math.round(maxVal/2)}</text>
          <text x="35" y="163" fontSize="9" textAnchor="end" fill="#64748b">0</text>
          
          {prompt.data.map((d, s) => {
            const has3 = d.v3 !== undefined;
            const bw = has3 ? 9 : 14;
            const gap = has3 ? 3 : 4;
            const barX = 60 + s * (240 / prompt.data.length);
            const h1 = (d.v1 / maxVal) * 140;
            const h2 = (d.v2 / maxVal) * 140;
            const h3 = has3 ? (d.v3 / maxVal) * 140 : 0;
            const center = barX + (has3 ? bw + gap : bw / 2);
            return (
              <g key={s}>
                <rect x={barX} y={160 - h1} width={bw} height={h1} fill="#3b82f6" rx="1" />
                <rect x={barX + bw + gap} y={160 - h2} width={bw} height={h2} fill="#f87171" rx="1" />
                {has3 && <rect x={barX + (bw + gap) * 2} y={160 - h3} width={bw} height={h3} fill="#22c55e" rx="1" />}
                <text x={center} y="175" fontSize="9" textAnchor="middle" fill="#1e293b" fontWeight="bold">{d.label}</text>
              </g>
            );
          })}
          
          {/* Legend */}
          <rect x="170" y="190" width="12" height="8" fill="#3b82f6" />
          <text x="185" y="197" fontSize="9" fill="#1e293b">{prompt.labels?.legend1 || "Series 1"}</text>
          <rect x="230" y="190" width="12" height="8" fill="#f87171" />
          <text x="245" y="197" fontSize="9" fill="#1e293b">{prompt.labels?.legend2 || "Series 2"}</text>
          {prompt.data[0]?.v3 !== undefined && <>
            <rect x="290" y="190" width="12" height="8" fill="#22c55e" />
            <text x="305" y="197" fontSize="9" fill="#1e293b">{prompt.labels?.legend3 || "Series 3"}</text>
          </>}
        </svg>
      </div>
    );
  }

  if (prompt.graphic === 'line') {
    const allVals = prompt.data.flatMap(d => [d.v1 || 0, d.v2 || 0, d.v3 || 0]);
    const maxVal = Math.max(...allVals, 1);
    const minVal = Math.min(...allVals, 0);
    const padding = Math.max(maxVal - minVal, 1) * 0.15;
    const topBound = maxVal + padding;
    const bottomBound = minVal - padding;
    const range = Math.max(topBound - bottomBound, 0.1);
    const scaleY = (val) => 180 - ((val - bottomBound) / range) * 150;
    const pathData = (key) => prompt.data.map((d, idx) => `${60 + idx * (320 / (prompt.data.length - 1))},${scaleY(d[key] || 0)}`).join(" ");
    const zeroY = scaleY(0);
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="flex gap-4 mb-3 text-[11px] font-bold">
          {prompt.labels.l1 && <div className="flex items-center gap-1"><div className="w-4 h-1 bg-blue-500"></div> {prompt.labels.l1}</div>}
          {prompt.labels.l2 && <div className="flex items-center gap-1"><div className="w-4 h-1 bg-green-500"></div> {prompt.labels.l2}</div>}
          {prompt.labels.l3 && <div className="flex items-center gap-1"><div className="w-4 h-1 bg-orange-500"></div> {prompt.labels.l3}</div>}
        </div>
        <svg viewBox="0 0 420 220" className="w-full h-full max-h-[320px]">
          {/* Grid lines */}
          {bottomBound < 0 && topBound > 0 && <line x1="60" y1={zeroY} x2="380" y2={zeroY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3" />}
          
          {/* Y-axis */}
          <line x1="60" y1="30" x2="60" y2="180" stroke="#64748b" strokeWidth="2" />
          {/* X-axis */}
          <line x1="60" y1="180" x2="380" y2="180" stroke="#64748b" strokeWidth="2" />
          
          {/* Y-axis label */}
          <text x="20" y="105" fontSize="11" fill="#1e293b" fontWeight="bold" transform="rotate(-90 20 105)" textAnchor="middle">{prompt.labels?.yUnit || "Value"}</text>
          
          {/* Data lines */}
          <path d={`M ${pathData("v1")}`} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
          {prompt.labels.l2 && <path d={`M ${pathData("v2")}`} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />}
          {prompt.labels.l3 && <path d={`M ${pathData("v3")}`} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />}
          
          {/* X-axis labels */}
          {prompt.data.map((d, idx) => <text key={idx} x={60 + idx * (320 / (prompt.data.length - 1))} y="195" fontSize="10" textAnchor="middle" fill="#1e293b" fontWeight="bold">{d.year}</text>)}
          
          {/* Y-axis scale */}
          <text x="55" y={scaleY(maxVal)} fontSize="9" textAnchor="end" fill="#64748b" fontWeight="bold">{maxVal.toFixed(1)}</text>
          <text x="55" y={scaleY((maxVal + minVal) / 2)} fontSize="9" textAnchor="end" fill="#64748b">{((maxVal + minVal) / 2).toFixed(1)}</text>
          <text x="55" y={scaleY(minVal)} fontSize="9" textAnchor="end" fill="#64748b" fontWeight="bold">{minVal.toFixed(1)}</text>
          
          {/* X-axis title */}
          <text x="220" y="212" fontSize="11" fill="#1e293b" fontWeight="bold" textAnchor="middle">Year</text>
        </svg>
      </div>
    );
  }

  if (prompt.graphic === 'table') {
    const hasY3 = prompt.data.some(r => r.y3 !== undefined);
    return (
      <div className="w-full p-4 overflow-x-auto">
        <table className="min-w-full border-collapse rounded-lg overflow-hidden border border-slate-200">
          <thead>
            <tr className="bg-slate-800 text-white text-sm">
              {prompt.headers.map((h, i) => <th key={i} className={`p-2 uppercase tracking-tighter whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="text-sm">
            {prompt.data.length === 0 ? (
              <tr><td colSpan={prompt.headers.length} className="p-4 text-center text-slate-400 italic">No data available</td></tr>
            ) : (
              prompt.data.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 font-bold border-b text-slate-700 whitespace-nowrap">{row.country || row.region}</td>
                  <td className="p-2 border-b text-slate-600 text-right">{row.y1}</td>
                  <td className="p-2 border-b text-slate-600 text-right">{row.y2}</td>
                  {hasY3 && <td className="p-2 border-b text-slate-600 text-right">{row.y3 ?? '—'}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (prompt.graphic === 'pie') {
    let currentAngle = 0;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 gap-3">
        <svg viewBox="0 0 100 100" className="w-32 h-32 drop-shadow">
          {prompt.data.map((slice, i) => {
            const startAngle = currentAngle;
            const sliceAngle = (slice.value / 100) * 360;
            currentAngle += sliceAngle;
            const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
            const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
            const x2 = 50 + 40 * Math.cos((Math.PI * (currentAngle - 90)) / 180);
            const y2 = 50 + 40 * Math.sin((Math.PI * (currentAngle - 90)) / 180);
            const largeArc = sliceAngle > 180 ? 1 : 0;
            return <path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={slice.color} stroke="white" strokeWidth="0.5" />;
          })}
        </svg>
        <div className="flex flex-col gap-1">
          {prompt.data.map((s, i) => <div key={i} className="flex items-center gap-2 text-[10px] font-bold"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div><span>{s.label} ({s.value}%)</span></div>)}
        </div>
      </div>
    );
  }

  if (prompt.graphic === 'process') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2">
        {prompt.data.map((step, i) => (
          <React.Fragment key={i}>
            <div className="w-full max-w-[200px] bg-white border border-teal-500 rounded p-2 text-center shadow-sm relative text-xs">
              <span className="absolute -left-2 -top-2 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">{i+1}</span>
              <span className="font-bold text-slate-700">{step}</span>
            </div>
            {i < prompt.data.length - 1 && <ArrowRight className="rotate-90 text-teal-300" size={16} />}
          </React.Fragment>
        ))}
      </div>
    );
  }
  if (prompt.graphic === 'mixed' && Array.isArray(prompt.panels)) {
    return (
      <div className="w-full flex flex-row flex-wrap gap-2 justify-center">
        {prompt.panels.map((panel, pi) => (
          <div key={pi} className="flex-1 min-w-[150px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 text-center">{panel.title}</p>
            <VisualRenderer prompt={{ ...panel }} />
          </div>
        ))}
      </div>
    );
  }

  return null;
};

const getSystemPrompt = (writingTask, prompt) => {
  if (writingTask === 'task2') {
    return `You are an expert IELTS Writing Examiner.
    Mark this IELTS Writing Task 2 essay accurately, but explain your feedback using SIMPLE, CLEAR language that a Band 4.5 student can understand while still being useful for a Band 7.5 student.
    Essay Prompt: ${prompt.instruction}.

    Grade strictly by the official IELTS Task 2 rubric:
    - Task Response
    - Coherence and Cohesion
    - Lexical Resource
    - Grammatical Range and Accuracy

    You must evaluate whether the essay has:
    - a clear thesis/position
    - developed body paragraphs with relevant support/examples
    - a logical conclusion

    CRITICAL FEEDBACK LANGUAGE INSTRUCTION:
    Use simple vocabulary and short sentences. Avoid complex academic terms.
    Instead of "insufficient cohesive devices", say "not enough linking words".
    Instead of "lexical sophistication", say "word choice" or "vocabulary".
    Instead of "subordinate clauses", say "complex sentences".
    Keep each criterion explanation to 1-2 SHORT, SIMPLE sentences.
    Keep tips brief, practical, and easy to understand.

    CRITICAL INSTRUCTION FOR DIAGNOSTIC TAGS (TOP 3 FOCUS AREAS):
    Return only the 3 most important focus areas in "diagnostic_tags" (maximum 3 tags).
    Prioritize higher-order writing quality first (Task Response quality, argument development, coherence, and paragraph logic).
    Do NOT let minor article/preposition mistakes dominate the top 3 unless frequent and meaning-changing.
    Use ONLY the exact 20 tags below.
    Nouns & Mechanics: Article Usage, Countability & Plurals, Pronoun Reference, Prepositional Accuracy, Word Forms
    Verbs & Time: Subject-Verb Agreement, Tense Consistency, Present Perfect vs. Past Simple, Gerunds vs. Infinitives, Passive Voice Construction
    Sentence Architecture: Sentence Boundaries (Fragments/Comma Splices), Relative Clauses, Subordination, Word Order, Parallel Structure
    Academic Discourse: Transitional Devices, Collocations, Academic Register, Nominalization, Hedging

    CRITICAL INSTRUCTION FOR GRAMMAR ERROR COUNTS:
    Return a "grammar_error_counts" object with exact counts for each grammar category found in the text.
    Use ONLY the exact 20 category keys below. Count ALL instances of each error type, not just presence/absence.
    If no errors of a type are found, do not include that key in the object.
    Category keys: "01_article_usage", "02_countability_and_plurals", "03_pronoun_reference", "04_prepositional_accuracy", "05_word_forms", "06_subject_verb_agreement", "07_tense_consistency", "08_present_perfect_vs_past_simple", "09_gerunds_vs_infinitives", "10_passive_voice_construction", "11_sentence_boundaries", "12_relative_clauses", "13_subordination", "14_word_order", "15_parallel_structure", "16_transitional_devices", "17_collocations", "18_academic_register", "19_nominalization", "20_hedging"

    CRITICAL INSTRUCTION FOR INLINE MAJOR ERRORS:
    Return a "major_errors" array with up to 5 items.
    Each item must include:
    - original_snippet: exact quote copied from the student's response (character-for-character)
    - correction: improved wording
    - explanation: one short reason in simple language
    Include only major errors that most affect band score clarity or accuracy.`;
  }

  return `You are a Senior IELTS Academic Examiner and EAP Specialist.
    Target audience: Students (ages 16-22) preparing for study abroad.
    Tone: Direct, honest, and helpful. Use SIMPLE, CLEAR language that a Band 4.5 student can understand.
    
    CRITICAL: The chart data below shows the EXACT values and labels. Do NOT invent or hallucinate data that is not present.
    Task 1 Prompt: ${prompt.instruction}.
    Chart Data: ${JSON.stringify(prompt.data || prompt.panels)}.
    
    IMPORTANT: If the chart shows colors or visual distinctions (e.g., "blue bars represent males, red bars represent females"), these are REAL features of the chart. The student MUST describe them. Do NOT penalize the student for mentioning colors or visual elements that are explicitly stated in the prompt.

    Evaluate the response on the four official IELTS Task 1 criteria. Assign each a Band Score (0-9.0, in 0.5 increments):

    1. Task Achievement (TA):
       CRITICAL: If a clear Overview statement summarising the main trend or key feature is absent, TA cannot exceed 5.0.
       Penalise hallucinated units (e.g., % symbols applied to years) or misquoted figures from the chart data.
       Penalise mechanical listing of all numbers without identifying key comparisons or overall patterns.

    2. Coherence & Cohesion (CC):
       Look for logical grouping of related data points and effective use of transitional phrases.

    3. Lexical Resource (LR):
       Reward accurate academic reporting vocabulary adapted to chart type: trend words for graphs (rose sharply, plateaued), comparative language for bar charts and tables, sequencing language for processes.

    4. Grammatical Range & Accuracy (GRA):
       Credit variety of complex structures. Minor punctuation errors alone should not heavily penalise this criterion.

    Overall Band Score: Average of the four criteria scores, rounded to nearest 0.5. Apply the Overview cap to TA before averaging.

    FEEDBACK RULES:
    - Write in VERY SIMPLE, CLEAR English. Use short sentences and basic vocabulary.
    - Avoid academic jargon. Say "linking words" not "cohesive devices". Say "word choice" not "lexical resource".
    - Per criterion: 1 SHORT sentence explaining the score + 1 SHORT sentence with a specific, easy-to-follow fix.
    - If overall band < 5.0: focus on overview structure and basic data coverage in tips.
    - If overall band > 6.5: focus on precise data selection, paraphrasing, and advanced vocabulary.

    CRITICAL INSTRUCTION FOR DIAGNOSTIC TAGS (TOP 3 FOCUS AREAS):
    Return the 3 most critical areas for improvement in "diagnostic_tags" (maximum 3 tags).
    Prioritise higher-order issues first: missing overview, poor data grouping, weak academic expression — then grammar.
    Do NOT let minor grammar dominate unless errors are frequent and affect meaning.
    Use ONLY the exact 20 tags below. Do not invent new tags.
    Nouns & Mechanics: Article Usage, Countability & Plurals, Pronoun Reference, Prepositional Accuracy, Word Forms
    Verbs & Time: Subject-Verb Agreement, Tense Consistency, Present Perfect vs. Past Simple, Gerunds vs. Infinitives, Passive Voice Construction
    Sentence Architecture: Sentence Boundaries (Fragments/Comma Splices), Relative Clauses, Subordination, Word Order, Parallel Structure
    Academic Discourse: Transitional Devices, Collocations, Academic Register, Nominalization, Hedging

    CRITICAL INSTRUCTION FOR GRAMMAR ERROR COUNTS:
    Return a "grammar_error_counts" object with counts for each error category found. Count ALL clear instances.
    If no errors of a type are found, omit that key.
    Category keys: "01_article_usage", "02_countability_and_plurals", "03_pronoun_reference", "04_prepositional_accuracy", "05_word_forms", "06_subject_verb_agreement", "07_tense_consistency", "08_present_perfect_vs_past_simple", "09_gerunds_vs_infinitives", "10_passive_voice_construction", "11_sentence_boundaries", "12_relative_clauses", "13_subordination", "14_word_order", "15_parallel_structure", "16_transitional_devices", "17_collocations", "18_academic_register", "19_nominalization", "20_hedging"

    CRITICAL INSTRUCTION FOR INLINE MAJOR ERRORS:
    Return a "major_errors" array with up to 5 items. Each must include:
    - original_snippet: exact quote copied character-for-character from the student's response
    - correction: improved wording
    - explanation: one brief sentence
    Include only errors that most affect clarity or band score.

    PRIORITY NEXT STEP:
    Return "priority_next_step": a single, direct command — the one most important thing this student must fix next.
    Examples: "Write a clear overview sentence stating the main trend before describing specific figures."
              "Group related data together instead of listing every number separately."
              "Use more precise trend vocabulary: replace 'went up' with 'rose sharply' or 'increased steadily'."`;
};

const normalizeBandScore = (rawBandScore, wordCount) => {
  const score = Number(rawBandScore);
  if (!Number.isFinite(score)) return 0;

  let adjusted = score;

  // Calibration: avoid under-scoring typical 6.0-6.5 level scripts.
  if (wordCount >= 140 && adjusted >= 5 && adjusted < 6.5) {
    adjusted += 0.5;
  }

  adjusted = Math.max(0, Math.min(9, adjusted));
  return Math.round(adjusted * 2) / 2;
};

function CustomTooltip({ error, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <span
      className="relative inline"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top });
        setVisible(true);
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="fixed z-[200] w-72 bg-slate-900 rounded-xl shadow-lg p-4 pointer-events-none text-left"
          style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, calc(-100% - 12px))' }}
        >
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Error Analysis</p>
          <div className="mb-2">
            <span className="text-[10px] font-black text-red-400 uppercase">✕ Original</span>
            <p className="text-sm text-red-300 italic mt-0.5">"{error.original_snippet}"</p>
          </div>
          <div className="mb-2">
            <span className="text-[10px] font-black text-green-400 uppercase">✓ Correction</span>
            <p className="text-sm text-green-300 mt-0.5">"{error.correction}"</p>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase">Why</span>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{error.explanation}</p>
          </div>
          <div className="absolute bottom-0 left-1/2 translate-y-full -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
}

const renderHighlightedSubmission = (text, majorErrors = []) => {
  if (!text) return null;

  const validErrors = (Array.isArray(majorErrors) ? majorErrors : [])
    .filter((err) => typeof err?.original_snippet === 'string' && err.original_snippet.trim().length > 0)
    .slice(0, 5);

  if (validErrors.length === 0) return text;

  let segments = [{ text, error: null }];

  validErrors.forEach((error) => {
    const snippet = error.original_snippet;
    const nextSegments = [];

    segments.forEach((segment) => {
      if (segment.error) {
        nextSegments.push(segment);
        return;
      }

      let start = 0;
      let idx = segment.text.indexOf(snippet, start);

      if (idx === -1) {
        nextSegments.push(segment);
        return;
      }

      while (idx !== -1) {
        const before = segment.text.slice(start, idx);
        if (before) nextSegments.push({ text: before, error: null });
        nextSegments.push({ text: snippet, error });
        start = idx + snippet.length;
        idx = segment.text.indexOf(snippet, start);
      }

      const after = segment.text.slice(start);
      if (after) nextSegments.push({ text: after, error: null });
    });

    segments = nextSegments;
  });

  return segments.map((segment, idx) => {
    if (!segment.error) return <React.Fragment key={idx}>{segment.text}</React.Fragment>;

    return (
      <CustomTooltip key={idx} error={segment.error}>
        <span className="text-red-700 underline decoration-red-500 decoration-2 underline-offset-2 font-semibold cursor-help">
          {segment.text}
        </span>
      </CustomTooltip>
    );
  });
};

// Moving API call logic outside component for clarity and to avoid closure issues
const callGeminiWithRetry = async (payload, systemPrompt, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  const url = "https://hayford-learning-hub.onrender.com/api/ai/mark";
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: payload,
          systemInstruction: systemPrompt,
          responseSchema: {
            type: "OBJECT",
            properties: {
              bandScore: { type: "NUMBER" },
              taskAchievement: { type: "STRING" },
              coherenceCohesion: { type: "STRING" },
              lexicalResource: { type: "STRING" },
              grammarAccuracy: { type: "STRING" },
              improvementTips: { type: "ARRAY", items: { type: "STRING" } },
              modelHighlights: { type: "STRING" },
              diagnostic_tags: { type: "ARRAY", items: { type: "STRING" } },
              grammar_error_counts: { 
                type: "OBJECT",
                properties: {
                  "01_article_usage": { type: "NUMBER" },
                  "02_countability_and_plurals": { type: "NUMBER" },
                  "03_pronoun_reference": { type: "NUMBER" },
                  "04_prepositional_accuracy": { type: "NUMBER" },
                  "05_word_forms": { type: "NUMBER" },
                  "06_subject_verb_agreement": { type: "NUMBER" },
                  "07_tense_consistency": { type: "NUMBER" },
                  "08_present_perfect_vs_past_simple": { type: "NUMBER" },
                  "09_gerunds_vs_infinitives": { type: "NUMBER" },
                  "10_passive_voice_construction": { type: "NUMBER" },
                  "11_sentence_boundaries": { type: "NUMBER" },
                  "12_relative_clauses": { type: "NUMBER" },
                  "13_subordination": { type: "NUMBER" },
                  "14_word_order": { type: "NUMBER" },
                  "15_parallel_structure": { type: "NUMBER" },
                  "16_transitional_devices": { type: "NUMBER" },
                  "17_collocations": { type: "NUMBER" },
                  "18_academic_register": { type: "NUMBER" },
                  "19_nominalization": { type: "NUMBER" },
                  "20_hedging": { type: "NUMBER" }
                }
              },
              major_errors: {
                type: "ARRAY",
                maxItems: 5,
                items: {
                  type: "OBJECT",
                  properties: {
                    original_snippet: { type: "STRING" },
                    correction: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["original_snippet", "correction", "explanation"]
                }
              },
              priority_next_step: { type: "STRING" }
            },
            required: ["bandScore", "taskAchievement", "coherenceCohesion", "lexicalResource", "grammarAccuracy", "improvementTips", "modelHighlights", "diagnostic_tags", "grammar_error_counts", "major_errors", "priority_next_step"]
          }
        })
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         throw new Error(`HTTP ${response.status}: ${JSON.stringify(errData)}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

export default function App() {
  const apiKey = true;
  const [writingTask, setWritingTask] = useState(forcedWritingTask || 'task1');
  const [currentPrompt, setCurrentPrompt] = useState(() => {
    const initialTask = forcedWritingTask || 'task1';
    // For 'both', start with Task 1
    const pool = (initialTask === 'task2') ? TASK_2_PROMPTS : TASK_1_PROMPTS;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(1200);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [view, setView] = useState("practice");
  const [activeTaskId, setActiveTaskId] = useState(initialTaskMeta?.assignment_id || null);
  const [saveMessage, setSaveMessage] = useState("");
  
  // For 'both' mode: track which task student is currently working on
  const [currentTaskInBothMode, setCurrentTaskInBothMode] = useState('task1'); // task1 or task2
  const [task1Completed, setTask1Completed] = useState(false);
  const [showFocusMenu, setShowFocusMenu] = useState(true);
  const [expandedChart, setExpandedChart] = useState(false);
  
  // Determine actual current task type for rendering
  const actualCurrentTask = writingTask === 'both' ? currentTaskInBothMode : writingTask;
  const minWordTarget = actualCurrentTask === 'task2' ? 100 : 150;

  const getPromptPool = (taskType) => (taskType === 'task2' ? TASK_2_PROMPTS : TASK_1_PROMPTS);
  const getRandomPrompt = (taskType) => {
    const pool = getPromptPool(taskType);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const switchWritingTask = (taskType) => {
    if (forcedWritingTask) return;
    setWritingTask(taskType);
    const newPrompt = getRandomPrompt(taskType);
    setCurrentPrompt(newPrompt);
    setText('');
    setFeedback(null);
    setView('practice');
    setTimeLeft(1200);
    setHasStarted(false);
    setIsTimerRunning(false);
    setShowWarning(false);
    setErrorMessage('');
  };

  const handleReturnToHub = () => {
    window.location.href = "/";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // Ensure prompt is set on initial mount
  useEffect(() => {
    if (!currentPrompt || !currentPrompt.instruction) {
      const initialTask = forcedWritingTask || 'task1';
      const pool = (initialTask === 'task2') ? TASK_2_PROMPTS : TASK_1_PROMPTS;
      const randomPrompt = pool[Math.floor(Math.random() * pool.length)];
      setCurrentPrompt(randomPrompt);
    }
  }, []);

  useEffect(() => {
    let timer;
    if (isTimerRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setShowWarning(true);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, timeLeft]);

  const startPractice = (prompt) => {
    setCurrentPrompt(prompt);
    setText("");
    setTimeLeft(1200);
    setHasStarted(false);
    setFeedback(null);
    setView("practice");
    setIsTimerRunning(false); 
    setShowWarning(false);
    setErrorMessage("");
    setShowFocusMenu(true);
  };

  const handleProceedToTask2 = () => {
    // Transition from Task 1 to Task 2 in Both mode
    setCurrentTaskInBothMode('task2');
    setTask1Completed(true);
    
    // Get a random Task 2 prompt
    const task2Prompt = getRandomPrompt('task2');
    setCurrentPrompt(task2Prompt);
    
    // Reset the writing interface
    setText("");
    setTimeLeft(1200);
    setHasStarted(false);
    setFeedback(null);
    setView("practice");
    setIsTimerRunning(false);
    setShowWarning(false);
    setErrorMessage("");
    setSaveMessage("");
    setShowFocusMenu(true);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (val.trim().length > 0 && !hasStarted) {
      setHasStarted(true);
      setIsTimerRunning(true);
    }
  };

  const getWordCount = (val) => val.trim() ? val.trim().split(/\s+/).length : 0;
  const getTimerButtonLabel = () => {
    if (!hasStarted) return "START";
    return isTimerRunning ? "PAUSE" : "RESUME";
  };

  const toggleTimer = () => {
    if (!hasStarted) setHasStarted(true);
    setIsTimerRunning(!isTimerRunning);
  };

  const submitWriting = async () => {
    if (isLoading) return;

    const wordCount = getWordCount(text);

    if (wordCount < minWordTarget) {
      setErrorMessage(`Please write at least ${minWordTarget} words before submitting.`);
      return;
    }

    setIsLoading(true);
    setIsTimerRunning(false);
    setShowWarning(false);
    setErrorMessage("");
    setSaveMessage("");

    const systemPrompt = getSystemPrompt(actualCurrentTask, currentPrompt);

    try {
      if (!apiKey) {
        throw new Error("API Key is missing. Please configure VITE_GEMINI_API_KEY in a .env file.");
      }
      const feedbackData = await callGeminiWithRetry(`Student Response: ${text}`, systemPrompt);
      const calibratedBandScore = normalizeBandScore(feedbackData.bandScore, wordCount);
      const normalizedFeedback = {
        ...feedbackData,
        bandScore: calibratedBandScore
      };

      setFeedback(normalizedFeedback);
      setView("feedback");

      // Save to History Database (and mark assignment completed if opened from To-Do)
      const token = localStorage.getItem('token');
      if (token) {
        const taskIdNum = activeTaskId != null ? parseInt(activeTaskId, 10) : null;
        const scorePayload = {
          submitted_text: text,
          word_count: wordCount,
          overall_score: calibratedBandScore,
          ai_feedback: normalizedFeedback,
          diagnostic_tags: normalizedFeedback.diagnostic_tags || [],
          grammar_error_counts: normalizedFeedback.grammar_error_counts || {},
          module_type: 'writing',
          taskId: Number.isInteger(taskIdNum) ? taskIdNum : undefined,
          writingSessionId: sessionIdFromUrl
        };

        const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');
        const saveRes = await fetch(`${apiBase}/api/scores`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(scorePayload)
        });

        if (saveRes.ok) {
          setSaveMessage("Score Saved to Dashboard!");
          setTimeout(() => setSaveMessage(""), 4000);
        } else if (saveRes.status === 403) {
          const errData = await saveRes.json().catch(() => ({}));
          if (errData.error === 'upgrade_required') {
            setSaveMessage("");
            setErrorMessage("You've used your 1 free Writing test this month. Return to the dashboard to upgrade to Premium for unlimited access.");
          } else {
            setSaveMessage("");
            setErrorMessage(errData.message || "Access denied.");
          }
        } else {
          const contentType = saveRes.headers.get("content-type") || "";
          const errText = await saveRes.text();
          let errMsg = "Failed to save score to dashboard.";
          try {
            if (errText && contentType.includes("application/json")) {
              const errData = JSON.parse(errText);
              errMsg = errData.error || errData.details || errMsg;
            }
          } catch (_) {}
          setSaveMessage("");
          setErrorMessage(errMsg);
          console.error("Score save error", saveRes.status, errText);
        }
      }

    } catch (e) {
      console.error("AI Marking Error:", e);
      let errorMsg = "Connection Busy: The AI service is currently overloaded. Please try submitting again.";
      
      // Try to extract actual error message from backend
      if (e.message) {
        try {
          const match = e.message.match(/HTTP \d+: (.+)/);
          if (match) {
            const errorData = JSON.parse(match[1]);
            errorMsg = errorData.error || errorMsg;
          }
        } catch (_) {
          // If parsing fails, check if message contains useful info
          if (e.message.includes('API key')) {
            errorMsg = "API key issue on server. Please contact administrator.";
          } else if (e.message.includes('quota')) {
            errorMsg = "API quota exceeded. Please try again later.";
          } else if (e.message.includes('timeout')) {
            errorMsg = "Request timed out. Please try again.";
          }
        }
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      { !apiKey && (
        <div className="bg-red-500 text-white text-center text-xs font-bold py-2 shadow flex justify-center items-center gap-2">
          <AlertTriangle size={16} /> Missing API Key. Create a .env file and set VITE_GEMINI_API_KEY.
        </div>
      )}
      <header className="bg-white border-b px-6 py-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-50 shadow-sm gap-4">
        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-start">
          <button onClick={handleReturnToHub} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition-colors">
            <ArrowLeft size={16} /> Return to Learning Hub
          </button>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = '/dashboard'}>
            <img src={BRAND_LOGO_URL || '/logo.png'} alt="Institution Logo" onError={e => { e.target.onerror=null; e.target.src='/logo.png'; }} className="w-10 h-10 object-contain mx-auto" />
            <div><h1 className="font-bold text-lg leading-none text-slate-900 group-hover:text-slate-700 transition-colors">IELTS Master</h1><p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Marking Suite</p></div>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${timeLeft < 300 && hasStarted ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <Clock size={16} /><span className="font-mono font-bold text-lg">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>
          </div>
          {view === "practice" && <button onClick={() => startPractice(getRandomPrompt(writingTask))} className="text-sm font-bold text-slate-500 hover:text-amber-600 flex items-center gap-2 bg-white px-3 py-1.5 border rounded-lg transition-colors"><RefreshCw size={16} /> New Topic</button>}
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:text-red-600 flex items-center gap-2 transition-colors"><LogOut size={16} /> Logout</button>
        </div>
      </header>

      <div className="px-6 pt-4 bg-slate-50 border-b border-slate-200">
        <div className="max-w-md mx-auto bg-brand-primary/10 border border-brand-primary/20 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-primary text-center">
          {writingTask === 'both' ? (
            <div className="flex items-center justify-center gap-2">
              <span>Assignment: IELTS Both Tasks</span>
              <span className="bg-brand-primary text-white px-2 py-0.5 rounded text-[10px]">
                {currentTaskInBothMode === 'task1' ? 'Task 1 Active' : 'Task 2 Active'}
              </span>
            </div>
          ) : (
            <span>Assignment: {writingTask === 'task2' ? 'IELTS Task 2 Essay' : 'IELTS Task 1 Academic Report'}</span>
          )}
        </div>
      </div>
      
      <main className="flex-1 overflow-hidden flex flex-col">
        {view === "feedback" ? (
          <FeedbackView 
            feedback={feedback} 
            writingTask={actualCurrentTask}
            originalText={text} 
            saveMessage={saveMessage}
            onReset={() => startPractice(getRandomPrompt(writingTask))} 
            onNextRandom={() => startPractice(getRandomPrompt(writingTask))}
            isBothMode={writingTask === 'both'}
            currentTaskInBothMode={currentTaskInBothMode}
            onProceedToTask2={handleProceedToTask2}
          />
        ) : showFocusMenu ? (
          <PreTaskFocusMenu taskType={actualCurrentTask} onStartWriting={() => setShowFocusMenu(false)} />
        ) : (
          <div className="h-full flex flex-col lg:flex-row">
            {/* Visual Panel */}
            <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-r text-white scrollbar-hide" style={{ background: `linear-gradient(to bottom right, ${BRAND_PRIMARY}, ${BRAND_DARK})` }}>
              <div className="max-w-xl mx-auto">
                <div className="flex items-center gap-2 text-white/80 mb-2">{getIcon(currentPrompt.type)}<span className="font-black uppercase tracking-widest text-[10px]">{currentPrompt.type}</span></div>
                <h2 className="text-2xl font-black mb-4 text-white tracking-tight">{currentPrompt.title}</h2>
                {actualCurrentTask === 'task1' && (
                  <div className="bg-white/10 rounded-xl border border-white/20 p-5 mb-8 text-white/90 leading-relaxed font-medium italic">"{currentPrompt.instruction}"</div>
                )}
                {actualCurrentTask === 'task1' ? (
                  <div className="bg-white border border-white/20 shadow-sm rounded-2xl overflow-hidden mb-8 min-h-[350px] flex flex-col">
                    <div className="bg-brand-primary/15 border-b border-brand-primary/25 px-4 py-2 flex justify-between items-center">
                      <span className="text-[10px] font-black text-brand-primary/70 tracking-widest uppercase">Visual Data View</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-crimson-100 text-brand-primary px-2 py-0.5 rounded font-bold">TASK 1</span>
                        <button onClick={() => setExpandedChart(true)} className="text-brand-primary/50 hover:text-brand-primary transition-colors" title="Expand chart"><Maximize2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 cursor-zoom-in" onClick={() => setExpandedChart(true)}>
                      <div className="bg-white text-slate-900 p-4 rounded-xl w-full">
                        <VisualRenderer prompt={currentPrompt} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-8">
                    <div className="bg-white/10 border-2 border-white/20 rounded-2xl p-8 mb-4 text-center">
                      <div className="inline-block px-3 py-1 bg-white text-brand-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-4">Task 2 Essay Question</div>
                      <p className="text-lg font-bold text-white leading-relaxed">{currentPrompt.instruction}</p>
                    </div>
                    <div className="bg-white/10 border border-white/20 rounded-xl p-4 text-sm text-white/90">
                      <p className="font-bold mb-1 font-black uppercase tracking-tighter text-[10px] opacity-60">Instructions:</p>
                      <p>{TASK_INSTRUCTIONS[actualCurrentTask]}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Writing Panel */}
            <div className="w-full lg:w-1/2 flex flex-col bg-slate-50">
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex justify-between items-center mb-2 px-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Your Response</span><span className={`text-[10px] font-black uppercase ${getWordCount(text) < minWordTarget ? 'text-amber-500' : 'text-green-500'}`}>{getWordCount(text)} words</span></div>
                {actualCurrentTask === 'task1' && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 leading-relaxed">
                    <span className="font-bold">Instructions:</span> {TASK_INSTRUCTIONS[actualCurrentTask]}
                  </div>
                )}
                <textarea className="flex-1 w-full p-8 rounded-2xl border border-slate-200 shadow-sm focus:ring-4 focus:ring-slate-200 outline-none text-lg leading-relaxed resize-none font-serif placeholder:text-slate-300 transition-all" placeholder={actualCurrentTask === 'task1' ? 'The chart illustrates...' : 'It is often argued that...'} value={text} onChange={handleTextChange} disabled={isLoading} />
              </div>
              {errorMessage && <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2 font-bold animate-pulse"><XCircle size={16} /> {errorMessage}</div>}
              <div className="p-6 bg-white border-t flex justify-between items-center shadow-inner">
                 <button onClick={toggleTimer} className={`text-xs font-black tracking-widest px-4 py-2 rounded-lg transition-all ${isTimerRunning ? 'text-slate-400 hover:text-red-500' : 'text-slate-900 bg-slate-100'}`}>{getTimerButtonLabel()}</button>
                 <button onClick={submitWriting} disabled={isLoading || !apiKey} className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-10 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all transform active:scale-95 shadow-lg">
                   {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}{isLoading ? "Examiner Marking..." : "Submit Response"}
                 </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {expandedChart && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-6" onClick={() => setExpandedChart(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-brand-primary/10 border-b border-brand-primary/20 px-6 py-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-brand-primary/70 uppercase tracking-widest mb-0.5">{currentPrompt.type}</p>
                <h3 className="font-black text-slate-900 text-lg">{currentPrompt.title}</h3>
              </div>
              <button onClick={() => setExpandedChart(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><XCircle size={24} /></button>
            </div>
            <div className="p-8">
              <VisualRenderer prompt={currentPrompt} />
            </div>
          </div>
        </div>
      )}
      {showWarning && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Clock size={32} /></div>
            <h3 className="text-xl font-black mb-2">Time is Up!</h3>
            <p className="text-slate-500 text-sm mb-6">20 minutes have passed. You should finalize your response and submit for marking.</p>
            <div className="flex flex-col gap-2">
              <button onClick={submitWriting} disabled={!apiKey || isLoading} className="bg-slate-900 text-white py-3 rounded-xl font-bold disabled:bg-slate-300 flex items-center justify-center gap-2">
                {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                {isLoading ? "Submitting..." : "Submit Response"}
              </button>
              <button onClick={() => setShowWarning(false)} className="text-slate-400 text-xs font-bold py-2">Keep Writing (Late)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PromptList({ onSelect, prompts, writingTask }) {
  return (
    <div className="max-w-6xl mx-auto p-10 animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-10 text-center"><h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Practice Bank</h2><p className="text-slate-500 font-medium">{writingTask === 'task1' ? 'Select a data visualization task to begin your writing simulation.' : 'Select an IELTS Task 2 essay question to begin your writing simulation.'}</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prompts.map(prompt => (
          <div key={prompt.id} onClick={() => onSelect(prompt)} className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-amber-600 hover:shadow-2xl transition-all cursor-pointer flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-slate-50 rounded-lg group-hover:bg-amber-50 transition-colors">{getIcon(prompt.type)}</div><span className="text-[10px] font-black text-slate-400 group-hover:text-amber-700 transition-colors uppercase tracking-widest">{prompt.type}</span></div>
            <h4 className="font-bold text-lg mb-3 leading-tight group-hover:text-amber-700 transition-colors">{prompt.title}</h4>
            <div className="mt-auto pt-4 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-300 uppercase">20 min target</span><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:translate-x-1"><ChevronRight size={18} /></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FOCUS_DATA = {
  task1: [
    {
      title: "The Magic Overview",
      teaser: "The #1 reason students lose Task Achievement marks.",
      icon: <Eye size={22} />,
      body: [
        { type: 'paragraph', text: "Your overview is the most important paragraph in your response. Examiners look for it immediately — without one, Task Achievement cannot exceed Band 5." },
        { type: 'rule', label: "The Rule", text: "Write a 2-sentence overview directly after your introduction. Capture the BIGGEST overall trend and MOST STRIKING feature — no specific numbers." },
        { type: 'list', label: "Three questions to guide your overview:", items: [
          "What is the main direction? (rising / falling / stable?)",
          "What is the biggest difference? (highest vs. lowest?)",
          "Is anything unusual? (a sudden drop, one category behaving differently?)",
        ]},
        { type: 'tip', text: "Numbers belong in your body paragraphs only — never in your overview." },
      ],
      before: "The chart shows that in 2000, Sales were 500, and by 2020, they had increased to 1,200 while Region B stayed low.",
      after: "Overall, it is clear that sales figures rose significantly across all three regions, with Region A consistently recording the highest values throughout the period.",
    },
    {
      title: "Grouping Data",
      teaser: "Stop writing year by year — write by trend instead.",
      icon: <Layout size={22} />,
      body: [
        { type: 'paragraph', text: "Most students describe charts year by year: '...in 2000 it was X, in 2005 it was Y...' This produces a list, not an analysis — and keeps your score at Band 5." },
        { type: 'rule', label: "The Rule", text: "Group data by TREND: what went up? what went down? what stayed the same? Write one paragraph per group." },
        { type: 'table', headers: ["Chart Type", "How to Group"], rows: [
          ["Line Graph", "Lines that rose together vs. lines that fell or diverged"],
          ["Bar Chart", "Bars that increased vs. bars that decreased"],
          ["Table", "Countries/items with high values vs. low values"],
          ["Pie Chart", "Largest segments vs. smallest segments"],
        ]},
        { type: 'tip', text: "Always support each group with specific figures as evidence." },
      ],
      before: "In 2000, Country A was 45%. In 2005 it was 50%. In 2010 it rose to 60%. Country B was 30% in 2000...",
      after: "Countries A and B showed a steady upward trend over the period, rising from 45% and 30% respectively in 2000 to 60% and 48% by 2010.",
    },
    {
      title: "Vocabulary of Change",
      teaser: "Ban 'went up' and 'went down' from your writing forever.",
      icon: <BookOpen size={22} />,
      body: [
        { type: 'paragraph', text: "Lexical Resource accounts for 25% of your score. Using the same two verbs repeatedly signals limited vocabulary. You need a range of language for movement and change." },
        { type: 'table', headers: ["Speed", "Increase ↑", "Decrease ↓"], rows: [
          ["Rapid",    "surged · skyrocketed · shot up · soared",    "plummeted · dropped sharply · collapsed"],
          ["Gradual",  "rose steadily · climbed · edged upward",     "declined · dipped slightly · eased downward"],
          ["No change","—",                                           "remained stable · plateaued · levelled off"],
        ]},
        { type: 'rule', label: "Also use nouns for variety", text: "'there was a sharp rise...' / 'a gradual decline was observed...' / 'the figure experienced a significant surge.'" },
        { type: 'tip', text: "Mixing verbs and noun phrases signals sophistication — and earns higher marks." },
      ],
      before: "The number went up quickly from 2000 to 2010, then went down slowly after that.",
      after: "The figure surged between 2000 and 2010, before declining gradually over the following decade.",
    },
    {
      title: "Comparing & Contrasting",
      teaser: "One linking word can lift your Coherence score by a full band.",
      icon: <BarIcon size={22} />,
      body: [
        { type: 'paragraph', text: "Task 1 is fundamentally about comparison. Examiners reward students who connect data points clearly within a single sentence rather than listing them separately." },
        { type: 'list', label: "Contrast connectors:", items: [
          "while · whereas",
          "in contrast · by comparison",
          "on the other hand · however",
        ]},
        { type: 'list', label: "Similarity connectors:", items: [
          "similarly · likewise",
          "in the same way · equally",
        ]},
        { type: 'rule', label: "Strongest structure", text: "[Trend A + data]  +  contrast word  +  [Trend B + data]" },
        { type: 'tip', text: "Aim for at least one clear comparison sentence in every body paragraph." },
      ],
      before: "Country A's rate was 80%. Country B's rate was 20%. They were very different.",
      after: "Country A's rate reached 80%, whereas Country B remained considerably lower at just 20%, representing a four-fold difference.",
    },
    {
      title: "Tense & Time",
      teaser: "Mixing up tenses is an instant Band 5 ceiling — easy to fix.",
      icon: <Clock size={22} />,
      body: [
        { type: 'paragraph', text: "Many students mix tenses when describing charts. This is penalized under Grammatical Range and Accuracy. The rule is simple: look at the dates on the chart and follow them exactly." },
        { type: 'table', headers: ["Chart Dates", "Tense to Use", "Example"], rows: [
          ["Past only (e.g. 2000–2020)",  "Past simple",                       "Sales increased steadily."],
          ["Past + present data",          "Past simple + present perfect",     "Sales grew and have now reached..."],
          ["Future projection",            "Future passive",                    "Sales are projected to rise."],
          ["Single present year",          "Present simple",                    "Agriculture accounts for 40%."],
        ]},
        { type: 'tip', text: "Never write 'accounted' for a present-day pie chart — if the date is now, use present tense." },
      ],
      before: "In 2010, the rate increases to 5% and is projected to increase in 2025 because it was rising.",
      after: "In 2010, the rate rose to 5% and is projected to reach 8% by 2025, continuing its upward trajectory.",
    },
  ],
  task2: [
    {
      title: "Deconstruct the Question",
      teaser: "Answering the wrong question type will cap you at Band 5 — no matter how good your English is.",
      icon: <BookOpen size={22} />,
      body: [
        { type: 'paragraph', text: "Every mark in Task Achievement depends on identifying and answering the correct question TYPE. Many students write beautifully — in the wrong structure." },
        { type: 'table', headers: ["Question Type", "Key Words", "What You Must Do"], rows: [
          ["Opinion Essay",       "Do you agree or disagree?",              "Give a clear personal opinion in intro AND conclusion."],
          ["Discussion Essay",    "Discuss both views + give your opinion", "One paragraph per side, then state your view clearly."],
          ["Problem / Solution",  "What problems? What solutions?",         "Describe problems AND suggest practical solutions."],
          ["Adv / Disadv",        "Do advantages outweigh disadvantages?",  "Cover both sides. Give opinion only if explicitly asked."],
        ]},
        { type: 'tip', text: "30-second check: underline the instruction words. Ask — am I giving MY view, or DESCRIBING both sides?" },
      ],
      before: "'Do you agree or disagree?' → Student writes: 'There are many advantages and disadvantages of social media...' (wrong structure — that's a discussion format).",
      after: "'Do you agree or disagree?' → 'I strongly agree that the negative effects of social media outweigh the positives, primarily due to its impact on mental health and social behavior.'",
    },
    {
      title: "The 4-Sentence Introduction",
      teaser: "A perfect introduction takes under 5 minutes and follows the same formula every time.",
      icon: <FileText size={22} />,
      body: [
        { type: 'paragraph', text: "A strong Task 2 introduction contains exactly four sentences. Its purpose is to show the examiner you understand the topic and have a clear position — not to impress with rare vocabulary." },
        { type: 'list', label: "The formula — 4 sentences, in order:", items: [
          "1.  Hook — A broad general statement about the topic. Do NOT copy the question word-for-word.",
          "2.  Paraphrase — Restate the question in your own words using synonyms.",
          "3.  Thesis — State your clear opinion or position directly.",
          "4.  Outline — Briefly signal your two main body paragraph ideas.",
        ]},
        { type: 'tip', text: "Common mistake: spending 10+ minutes on the intro trying to write something 'perfect.' Keep it structured and move on — body paragraphs earn the majority of marks." },
      ],
      before: "Technology is everywhere. Many people think technology is making people less social. I think this is true. I will talk about this.",
      after: "The rapid growth of digital technology has fundamentally altered the way people communicate. It is widely debated whether this shift has reduced meaningful face-to-face interaction. While technology limits some social behaviors, I believe it primarily creates new forms of connection. This essay will examine its impact on traditional socializing and the rise of digital communities.",
    },
    {
      title: "The PEEL Paragraph",
      teaser: "Every body paragraph should follow the same four-part structure — every single time.",
      icon: <Layout size={22} />,
      body: [
        { type: 'paragraph', text: "PEEL gives your body paragraphs a clear, logical structure that examiners reward. Without it, paragraphs often feel like a list of unconnected points." },
        { type: 'table', headers: ["Letter", "Part", "Role", "Length"], rows: [
          ["P", "Point",   "One clear topic sentence — one idea only",                              "1 sentence"],
          ["E", "Evidence","Specific example, statistic, or scenario",                              "1–2 sentences"],
          ["E", "Explain", "WHY the evidence supports your argument — the most important step",     "1–2 sentences"],
          ["L", "Link",    "Connect back to the question or your thesis",                           "1 sentence"],
        ]},
        { type: 'tip', text: "Aim for 5–7 sentences per paragraph. Two strong PEEL paragraphs score much higher than three short, underdeveloped ones." },
      ],
      before: "Technology makes people less social. People use phones all the time. This is bad for society.",
      after: "One significant consequence of widespread technology use is a reduction in face-to-face communication. Studies suggest that average household conversation time has dropped as screen use has increased. This matters because strong social bonds are formed through direct interaction — their erosion may lead to increased isolation. It is therefore evident that technology poses a genuine threat to traditional social behavior.",
    },
    {
      title: "Academic Tone",
      teaser: "Writing the way you speak is the fastest way to stay at Band 5.",
      icon: <Trophy size={22} />,
      body: [
        { type: 'paragraph', text: "Academic register is assessed under Lexical Resource. Informal expressions signal to the examiner you are not ready for academic writing. The fix: replace casual phrases with formal equivalents." },
        { type: 'table', headers: ["❌  Informal — Avoid", "✓  Academic — Use Instead"], rows: [
          ["I think...",            "It could be argued that... / It is widely held that..."],
          ["A lot of people...",    "A significant proportion of the population..."],
          ["Bad for society",       "detrimental to society / has adverse effects on..."],
          ["Get better",            "improve significantly"],
          ["Because of this",       "As a result / Consequently"],
          ["I will talk about...",  "This essay will examine..."],
        ]},
        { type: 'tip', text: "The test: read each sentence and ask — 'Would I write this in a formal report?' If no, rewrite it. Precise and formal beats rare vocabulary used incorrectly." },
      ],
      before: "I think a lot of young people are bad at saving money because they buy lots of things they don't need.",
      after: "It could be argued that a considerable proportion of young adults struggle with financial management as a result of impulsive consumer behavior.",
    },
    {
      title: "The 2-Minute Conclusion",
      teaser: "Your conclusion should take 2 minutes and contain absolutely nothing new.",
      icon: <CheckCircle2 size={22} />,
      body: [
        { type: 'paragraph', text: "The conclusion is the most frequently mishandled section. Two common mistakes: (1) introducing a new idea, and (2) skipping it due to time pressure. Both significantly lower your score." },
        { type: 'list', label: "A strong conclusion has exactly 2 sentences:", items: [
          "Sentence 1: Restate your thesis in NEW words — do not copy your introduction.",
          "Sentence 2: Briefly summarize your two main supporting points. Nothing more.",
        ]},
        { type: 'list', label: "Strong opening phrases:", items: [
          "'In conclusion, ...'",
          "'To summarize, ...'",
          "'Overall, ...'",
          "'In summary, ...'",
        ]},
        { type: 'tip', text: "Never start with 'In conclusion, I have discussed...' — this is weak and wastes words. Go directly to your restated thesis. Practice writing conclusions in under 2 minutes." },
      ],
      before: "In conclusion, I have discussed technology and social media. I think technology is bad. It makes people lonely. Also, we should limit screen time for young people.",
      after: "In conclusion, while technology offers undeniable benefits, it is my firm view that its negative impact on social behavior outweighs these advantages. By eroding face-to-face communication and fostering screen dependency, it poses a long-term risk to meaningful human connection.",
    },
  ],
};

function FocusCard({ title, teaser, icon, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left cursor-pointer rounded-2xl border-2 p-6 bg-white border-slate-200 hover:border-brand-primary/50 hover:shadow-xl transition-all duration-200 group active:scale-[0.98]"
    >
      <div className="mb-4 text-brand-primary transition-colors">{icon}</div>
      <h3 className="font-black text-sm mb-2 uppercase tracking-tight text-slate-900 group-hover:text-brand-primary transition-colors">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{teaser}</p>
      <div className="mt-4 flex items-center gap-1 text-brand-primary/70 text-xs font-bold">
        <BookOpen size={12} /> Read lesson →
      </div>
    </button>
  );
}

function FocusLessonModal({ lesson, onClose, onStartWriting }) {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="text-brand-primary">{lesson.icon}</div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight">{lesson.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors font-bold text-sm flex items-center gap-1">
            <XCircle size={20} />
          </button>
        </div>
        <div className="px-8 py-6 space-y-4">
          {lesson.body.map((item, i) => {
            if (item.type === 'paragraph') return (
              <p key={i} className="text-sm text-slate-700 leading-relaxed">{item.text}</p>
            );
            if (item.type === 'rule') return (
              <div key={i} className="bg-slate-50 border-l-4 border-slate-700 rounded-r-xl px-5 py-3">
                {item.label && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>}
                <p className="text-sm text-slate-800 font-semibold leading-relaxed">{item.text}</p>
              </div>
            );
            if (item.type === 'list') return (
              <div key={i} className="space-y-1">
                {item.label && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{item.label}</p>}
                <ul className="space-y-1.5 ml-1">
                  {item.items.map((it, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
            if (item.type === 'table') return (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-primary text-white">
                      {item.headers.map((h, j) => (
                        <th key={j} className="px-4 py-2.5 font-black text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {item.rows.map((row, j) => (
                      <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-2.5 text-slate-700 border-t border-slate-100 text-xs leading-snug">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            if (item.type === 'tip') return (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex gap-3">
                <span className="text-amber-500 font-black text-sm shrink-0">💡</span>
                <p className="text-sm text-amber-800 leading-relaxed">{item.text}</p>
              </div>
            );
            return null;
          })}
          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200">
            <div className="bg-red-50 px-5 py-4 border-b border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">✕ Weak Example</p>
              <p className="text-sm text-red-800 italic leading-relaxed">"{lesson.before}"</p>
            </div>
            <div className="bg-green-50 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">✓ Strong Example</p>
              <p className="text-sm text-green-800 leading-relaxed">"{lesson.after}"</p>
            </div>
          </div>
        </div>
        <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-sm font-bold flex items-center gap-2 transition-colors">
            <ArrowLeft size={16} /> Back to strategies
          </button>
          <button
            onClick={onStartWriting}
            className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 active:scale-95"
          >
            <Send size={16} /> Got it — Start Writing
          </button>
        </div>
      </div>
    </div>
  );
}

function PreTaskFocusMenu({ taskType, onStartWriting }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const cards = FOCUS_DATA[taskType] || FOCUS_DATA.task1;
  const activeLesson = activeIndex !== null ? cards[activeIndex] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="text-center mb-3">
          <div className="inline-block px-4 py-1.5 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4">
            {taskType === 'task1' ? 'Task 1 Academic Report' : 'Task 2 Essay'}
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Pre-Writing Focus</h2>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 mb-8 flex items-start gap-4">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm text-amber-900 mb-1">Choose ONE strategy to focus on — not all five.</p>
            <p className="text-xs text-amber-700 leading-relaxed">Trying to think about everything at once hurts your writing. Pick the one area you struggle with most, read the lesson, then start writing with that single goal in mind.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {cards.map((card, i) => (
            <FocusCard key={i} title={card.title} teaser={card.teaser} icon={card.icon} onSelect={() => setActiveIndex(i)} />
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onStartWriting}
            className="text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center gap-2 border border-slate-300 hover:border-slate-500 px-6 py-3 rounded-xl transition-all"
          >
            Start writing now →
          </button>
        </div>
      </div>

      {activeLesson && (
        <FocusLessonModal
          lesson={activeLesson}
          onClose={() => setActiveIndex(null)}
          onStartWriting={onStartWriting}
        />
      )}
    </div>
  );
}

function FeedbackView({ feedback, writingTask, originalText, saveMessage, onReset, onNextRandom, isBothMode, currentTaskInBothMode, onProceedToTask2 }) {
  if (!feedback) return null;
  const focusTags = Array.isArray(feedback.diagnostic_tags) ? feedback.diagnostic_tags.slice(0, 3) : [];
  
  // Determine if we should show "Proceed to Task 2" button
  const showProceedToTask2 = isBothMode && currentTaskInBothMode === 'task1';

  return (
    <div className="max-w-4xl mx-auto p-10 animate-in zoom-in-95 duration-500 relative">
      {saveMessage && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300">
           <CheckCircle2 size={18} /> {saveMessage}
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-12 text-center text-white relative overflow-hidden">
          <div className="inline-block px-4 py-1 bg-white/10 rounded-full text-[10px] font-black tracking-widest mb-6 border border-white/20 uppercase">{writingTask === 'task1' ? 'Task 1 Analytical Report' : 'Task 2 Essay Evaluation'}</div>
          <div className="text-8xl font-black mb-6 flex justify-center items-center gap-6"><Trophy className="w-12 h-12 text-yellow-500 drop-shadow-lg" /><span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{feedback.bandScore}</span></div>
          <p className="max-w-md mx-auto text-slate-400 text-sm italic font-medium">"{feedback.modelHighlights}"</p>
        </div>
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-8">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-4">Score Breakdown</h3>
              <Criterion label={writingTask === 'task1' ? 'Task Achievement' : 'Task Response'} text={feedback.taskAchievement} />
              <Criterion label="Coherence & Cohesion" text={feedback.coherenceCohesion} />
              <Criterion label="Lexical Resource" text={feedback.lexicalResource} />
              <Criterion label="Grammatical Range & Accuracy" text={feedback.grammarAccuracy} />
            </div>
            <div className="space-y-4">
              {feedback.priority_next_step && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Priority Next Step
                  </p>
                  <p className="text-sm font-bold text-red-900 leading-relaxed">{feedback.priority_next_step}</p>
                </div>
              )}
              <div className="bg-amber-50/50 rounded-2xl p-8 border border-amber-100">
                <h3 className="text-sm font-black mb-6 flex items-center gap-2 text-amber-900 uppercase"><Settings size={18} /> Examiner Advice</h3>
                <div className="space-y-4">{feedback.improvementTips.map((tip, idx) => (<div key={idx} className="flex gap-4 items-start"><div className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center shrink-0 text-[10px] font-black">{idx + 1}</div><p className="text-sm text-amber-900 leading-relaxed font-medium">{tip}</p></div>))}</div>
              </div>
            </div>
          </div>
          <div className="mb-12">
            {focusTags.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Top 3 Focus Areas</h3>
                <div className="flex flex-wrap gap-3">
                  {focusTags.map((tag) => {
                    const mappedTopicId = GRAMMAR_LAB_MAP[tag];
                    return (
                      <div key={tag} className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-indigo-900">{tag}</span>
                        {mappedTopicId && (
                          <a
                            href={`../grammar-lab/index.html?topicId=${mappedTopicId}`}
                            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded-lg transition-colors"
                          >
                            More Practice
                            <ArrowRight size={12} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Final Submission</h3>
            <div className="bg-slate-50 p-8 rounded-2xl font-serif text-slate-700 leading-loose italic border border-slate-100 shadow-inner whitespace-pre-wrap">
              {renderHighlightedSubmission(originalText, feedback.major_errors)}
            </div>
            {Array.isArray(feedback.major_errors) && feedback.major_errors.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-3">
                Hover over red underlined text to see the suggested correction and explanation.
              </p>
            )}
          </div>
          <div className="flex justify-center gap-4">
            {showProceedToTask2 ? (
              <button 
                onClick={onProceedToTask2} 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-12 py-5 rounded-2xl font-black hover:from-indigo-700 hover:to-purple-700 transition-all shadow-xl tracking-widest uppercase text-xs flex items-center gap-3"
              >
                Proceed to Task 2 <ArrowRight size={20} />
              </button>
            ) : (
              <button 
                onClick={() => window.location.href = '/dashboard'} 
                className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black hover:bg-black transition-all shadow-xl tracking-widest uppercase text-xs"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Criterion({ label, text }) {
  return (<div><h4 className="text-[10px] font-black uppercase text-slate-900 mb-1 tracking-wider">{label}</h4><p className="text-sm text-slate-600 leading-relaxed font-medium">{text}</p></div>);
}

function getIcon(type) {
  switch (type) {
    case "Bar Chart": return <BarIcon size={20} />;
    case "Line Graph": return <LineIcon size={20} />;
    case "Table": return <TableIcon size={20} />;
    case "Pie Chart": return <PieIcon size={20} />;
    case "Mixed Charts": return <Layout size={20} />;
    case "Map": return <MapIcon size={20} />;
    case "Process": return <RefreshCw size={20} />;
    default: return <FileText size={20} />;
  }
}
