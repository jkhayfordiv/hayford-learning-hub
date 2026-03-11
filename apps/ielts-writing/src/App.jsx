import React, { useState, useEffect } from 'react';
import { 
  BarChart as BarIcon, LineChart as LineIcon, Table as TableIcon, PieChart as PieIcon, Map as MapIcon, 
  Settings, Send, Clock, AlertTriangle, BookOpen, 
  CheckCircle2, ChevronRight, RefreshCw, Trophy, FileText, Layout, ArrowRight, XCircle, ArrowLeft, LogOut
} from 'lucide-react';

// Intercept JWT Token from Dashboard if it exists in URL params
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
const taskFromUrl = urlParams.get('task');
const forcedWritingTask = taskFromUrl === '2' ? 'task2' : taskFromUrl === '1' ? 'task1' : null;
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

// Using environment variable for API Key so it's not hardcoded in the file
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

const TASK_1_PROMPTS = [
  {
    id: 1,
    type: "Bar Chart",
    title: "University Enrollment by Faculty",
    instruction: "The bar chart below shows the number of students enrolled in five different faculties at a UK university in 2015 and 2020.",
    data: [
      { label: 'Arts', v1: 4000, v2: 3800 },
      { label: 'Science', v1: 3000, v2: 5500 },
      { label: 'Law', v1: 1200, v2: 1500 },
      { label: 'Business', v1: 5000, v2: 4800 },
      { label: 'Eng.', v1: 2500, v2: 4200 }
    ],
    labels: { legend1: "2015", legend2: "2020", yUnit: "Students" },
    graphic: "bar"
  },
  {
    id: 2,
    type: "Line Graph",
    title: "Household Energy Consumption",
    instruction: "The graph shows the average weekly energy consumption (in kWh) of a typical household in Australia between 2000 and 2020.",
    data: [
      { year: '2000', v1: 40, v2: 10, v3: 15 },
      { year: '2005', v1: 50, v2: 20, v3: 15 },
      { year: '2010', v1: 60, v2: 35, v3: 15 },
      { year: '2015', v1: 45, v2: 42, v3: 15 },
      { year: '2020', v1: 30, v2: 50, v3: 15 }
    ],
    labels: { l1: "Heating", l2: "Cooling", l3: "Lighting" },
    graphic: "line"
  },
  {
    id: 3,
    type: "Table",
    title: "World Coffee Production",
    instruction: "The table shows the amount of coffee produced (in millions of tonnes) in four different countries between 2010 and 2020.",
    data: [
      { country: 'Brazil', y1: 2.5, y2: 3.8 },
      { country: 'Vietnam', y1: 1.2, y2: 1.8 },
      { country: 'Colombia', y1: 0.8, y2: 0.9 },
      { country: 'Indonesia', y1: 0.6, y2: 0.7 }
    ],
    headers: ["Country", "2010 (m/t)", "2020 (m/t)"],
    graphic: "table"
  },
  {
    id: 4,
    type: "Pie Chart",
    title: "Leisure Activities in Japan (2014)",
    instruction: "The pie chart shows the distribution of time spent on various leisure activities by young adults in Japan in 2014.",
    data: [
      { label: 'Video Games', value: 65, color: '#3b82f6' },
      { label: 'Socializing', value: 15, color: '#ef4444' },
      { label: 'Reading', value: 5, color: '#10b981' },
      { label: 'Sports', value: 15, color: '#f59e0b' }
    ],
    graphic: "pie"
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
    instruction: "The bar chart compares the number of internet-connected computers per 1,000 students in five regions in 2005 and 2015.",
    data: [
      { label: 'Europe', v1: 120, v2: 280 },
      { label: 'N. America', v1: 180, v2: 320 },
      { label: 'Asia', v1: 60, v2: 210 },
      { label: 'S. America', v1: 75, v2: 190 },
      { label: 'Africa', v1: 25, v2: 110 }
    ],
    labels: { legend1: "2005", legend2: "2015", yUnit: "Computers per 1,000 students" },
    graphic: "bar"
  },
  {
    id: 7,
    type: "Line Graph",
    title: "Global Temperatures",
    instruction: "The graph shows changes in global surface temperatures relative to the average from 1880 to 2020.",
    data: [
      { year: '1880', v1: -0.1, v2: -0.2, v3: -0.15 },
      { year: '1920', v1: -0.15, v2: -0.1, v3: -0.12 },
      { year: '1960', v1: 0.05, v2: 0.0, v3: 0.02 },
      { year: '2000', v1: 0.4, v2: 0.35, v3: 0.38 },
      { year: '2020', v1: 0.9, v2: 0.85, v3: 0.88 }
    ],
    labels: { l1: "Land", l2: "Ocean", l3: "Average" },
    graphic: "line"
  },
  { id: 8, type: "Pie Chart", title: "Global Energy Consumption", instruction: "The chart below shows the world's energy consumption by fuel type in 2018.", data: [{ label: 'Oil', value: 33, color: '#3366cc' }, { label: 'Coal', value: 27, color: '#dc3912' }, { label: 'Gas', value: 24, color: '#ff9900' }, { label: 'Nuclear', value: 4, color: '#109618' }, { label: 'Renewables', value: 12, color: '#990099' }], graphic: "pie" },
  { id: 9, type: "Table", title: "Mobile Phone Ownership", instruction: "The table shows the percentage of people owning a mobile phone in seven different countries in 2010 and 2015.", data: [{ country: 'USA', y1: 85, y2: 92 }, { country: 'UK', y1: 82, y2: 90 }, { country: 'China', y1: 65, y2: 88 }, { country: 'India', y1: 40, y2: 72 }, { country: 'Brazil', y1: 55, y2: 80 }], headers: ["Country", "2010 (%)", "2015 (%)"], graphic: "table" },
  { id: 10, type: "Line Graph", title: "Unemployment Rates", instruction: "The graph shows unemployment rates in the US and Japan between 2000 and 2010.", data: [{ year: '2000', v1: 4.0, v2: 4.8 }, { year: '2002', v1: 5.8, v2: 5.4 }, { year: '2004', v1: 5.5, v2: 4.7 }, { year: '2006', v1: 4.6, v2: 4.1 }, { year: '2008', v1: 5.8, v2: 4.0 }, { year: '2010', v1: 9.6, v2: 5.1 }], labels: { l1: "USA", l2: "Japan", l3: "" }, graphic: "line" },
  { id: 11, type: "Process", title: "Electricity Production", instruction: "The diagram shows how electricity is produced in a coal-fired power station.", data: ["Coal Mining", "Furnace Burning", "Steam Production", "Turbine Rotation", "Generator", "Grid Distribution"], graphic: "process" },
  { id: 12, type: "Bar Chart", title: "Cinema Attendance", instruction: "The chart shows the frequency of cinema attendance by age group in a specific country in 2017.", data: [{ label: '14-24', v1: 45, v2: 50 }, { label: '25-34', v1: 30, v2: 35 }, { label: '35-44', v1: 15, v2: 20 }, { label: '45-54', v1: 10, v2: 12 }, { label: '55+', v1: 5, v2: 8 }], labels: { legend1: "Once/Month", legend2: "Weekly", yUnit: "%" }, graphic: "bar" },
  { id: 13, type: "Table", title: "International Student Numbers", instruction: "The table shows the number of international students in four countries over three decades.", data: [{ country: 'USA', y1: 300, y2: 600 }, { country: 'UK', y1: 150, y2: 400 }, { country: 'Australia', y1: 50, y2: 250 }, { country: 'Canada', y1: 40, y2: 200 }], headers: ["Country", "1990 (000s)", "2010 (000s)"], graphic: "table" },
  { id: 14, type: "Pie Chart", title: "Water Consumption by Sector", instruction: "The pie chart shows how total water consumption was distributed across five sectors in a developed country in 2022.", data: [{ label: 'Agriculture', value: 42, color: '#22c55e' }, { label: 'Industry', value: 23, color: '#3b82f6' }, { label: 'Domestic', value: 18, color: '#ef4444' }, { label: 'Energy', value: 9, color: '#f59e0b' }, { label: 'Public Services', value: 8, color: '#8b5cf6' }], graphic: "pie" },
  { id: 15, type: "Line Graph", title: "Metals Prices in Global Markets", instruction: "The line graph compares average monthly prices of gold, silver and copper between 2020 and 2024.", data: [{ year: '2020', v1: 2300, v2: 16, v3: 3.1 }, { year: '2021', v1: 2050, v2: 24, v3: 4.6 }, { year: '2022', v1: 1680, v2: 41, v3: 2.9 }, { year: '2023', v1: 1210, v2: 19, v3: 5.4 }, { year: '2024', v1: 980, v2: 47, v3: 3.3 }], labels: { l1: "Gold (USD/oz)", l2: "Silver (USD/oz)", l3: "Copper (USD/lb)" }, graphic: "line" },
  { id: 16, type: "Process", title: "Paper Recycling", instruction: "The diagram shows the process of recycling paper.", data: ["Waste Collection", "De-inking", "Pulping", "Rolling", "Drying", "New Paper"], graphic: "process" },
  { id: 17, type: "Bar Chart", title: "Fruit Consumption", instruction: "The chart shows the average daily fruit consumption of adults in five different cities.", data: [{ label: 'City A', v1: 1.2, v2: 1.5 }, { label: 'City B', v1: 0.8, v2: 1.1 }, { label: 'City C', v1: 2.1, v2: 2.3 }, { label: 'City D', v1: 1.5, v2: 1.8 }, { label: 'City E', v1: 1.0, v2: 1.2 }], labels: { legend1: "Male", legend2: "Female", yUnit: "Portions" }, graphic: "bar" },
  { id: 18, type: "Table", title: "Urbanization Rates", instruction: "The table shows the percentage of the population living in urban areas in four regions.", data: [{ country: 'Africa', y1: 30, y2: 45 }, { country: 'Asia', y1: 40, y2: 55 }, { country: 'Europe', y1: 70, y2: 78 }, { country: 'N. America', y1: 75, y2: 82 }], headers: ["Region", "2000 (%)", "2020 (%)"], graphic: "table" },
  { id: 19, type: "Pie Chart", title: "Student Accommodation", instruction: "The pie chart illustrates the preferred housing options of international students in a UK city in 2023.", data: [{ label: 'University Halls', value: 34, color: '#6366f1' }, { label: 'Private Rental', value: 29, color: '#ec4899' }, { label: 'Shared Flat', value: 19, color: '#06b6d4' }, { label: 'Homestay', value: 12, color: '#f59e0b' }, { label: 'Other', value: 6, color: '#94a3b8' }], graphic: "pie" },
  { id: 20, type: "Line Graph", title: "Software Subscriptions", instruction: "The graph shows the growth of subscribers for three software services.", data: [{ year: '2019', v1: 10, v2: 5, v3: 2 }, { year: '2020', v1: 15, v2: 8, v3: 5 }, { year: '2021', v1: 22, v2: 14, v3: 12 }, { year: '2022', v1: 30, v2: 25, v3: 20 }, { year: '2023', v1: 45, v2: 40, v3: 35 }], labels: { l1: "Cloud", l2: "Design", l3: "CRM" }, graphic: "line" },
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
  task2: 'Write about the following topic... Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.'
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
    const maxVal = Math.max(...prompt.data.flatMap(d => [d.v1, d.v2])) * 1.1;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="flex gap-4 mb-4 text-[10px] font-bold">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500"></div> {prompt.labels.legend1}</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400"></div> {prompt.labels.legend2}</div>
        </div>
        <svg viewBox="0 0 400 200" className="w-full h-full max-h-[300px]">
          <line x1="40" y1="20" x2="40" y2="170" stroke="#94a3b8" strokeWidth="1" />
          <line x1="40" y1="170" x2="380" y2="170" stroke="#94a3b8" strokeWidth="1" />
          {prompt.data.map((d, i) => {
            const xBase = 60 + i * (300 / prompt.data.length);
            const h1 = (d.v1 / maxVal) * 150;
            const h2 = (d.v2 / maxVal) * 150;
            return (
              <g key={i}>
                <rect x={xBase} y={170 - h1} width="12" height={h1} fill="#3b82f6" rx="1" />
                <rect x={xBase + 14} y={170 - h2} width="12" height={h2} fill="#f87171" rx="1" />
                <text x={xBase + 13} y="185" fontSize="8" textAnchor="middle" fill="#64748b" fontWeight="bold">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (prompt.graphic === 'mixed') {
    return (
      <div className="w-full h-full p-2 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {(prompt.panels || []).map((panel, index) => {
            if (panel.graphic === 'pie') {
              let angle = 0;
              return (
                <div key={index} className="border border-slate-200 rounded-xl p-3 bg-white">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">{panel.title}</h4>
                  <div className="flex items-center gap-4">
                    <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
                      {panel.data.map((slice, i) => {
                        const start = angle;
                        const sweep = (slice.value / 100) * 360;
                        angle += sweep;
                        const x1 = 50 + 40 * Math.cos((Math.PI * (start - 90)) / 180);
                        const y1 = 50 + 40 * Math.sin((Math.PI * (start - 90)) / 180);
                        const x2 = 50 + 40 * Math.cos((Math.PI * (angle - 90)) / 180);
                        const y2 = 50 + 40 * Math.sin((Math.PI * (angle - 90)) / 180);
                        const largeArc = sweep > 180 ? 1 : 0;
                        return <path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={slice.color} stroke="white" strokeWidth="0.6" />;
                      })}
                    </svg>
                    <div className="space-y-1">
                      {panel.data.map((slice, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span>{slice.label} ({slice.value}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (panel.graphic === 'bar') {
              const maxVal = Math.max(...panel.data.flatMap((d) => [d.v1, d.v2]), 1) * 1.1;
              return (
                <div key={index} className="border border-slate-200 rounded-xl p-3 bg-white">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">{panel.title}</h4>
                  <div className="text-[10px] font-bold text-slate-600 flex gap-3 mb-2">
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500" /> {panel.labels?.legend1 || 'Series 1'}</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-400" /> {panel.labels?.legend2 || 'Series 2'}</span>
                  </div>
                  <svg viewBox="0 0 320 180" className="w-full h-44">
                    <line x1="30" y1="10" x2="30" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="30" y1="150" x2="300" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                    {panel.data.map((d, i) => {
                      const xBase = 45 + i * (230 / panel.data.length);
                      const h1 = (d.v1 / maxVal) * 130;
                      const h2 = (d.v2 / maxVal) * 130;
                      return (
                        <g key={i}>
                          <rect x={xBase} y={150 - h1} width="10" height={h1} fill="#3b82f6" rx="1" />
                          <rect x={xBase + 12} y={150 - h2} width="10" height={h2} fill="#f87171" rx="1" />
                          <text x={xBase + 11} y="165" fontSize="8" textAnchor="middle" fill="#64748b">{d.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  }

  if (prompt.graphic === 'line') {
    const values = prompt.data.flatMap(d => [d.v1 || 0, d.v2 || 0, d.v3 || 0]);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = Math.max(maxVal - minVal, 1);
    const padding = range * 0.15;
    const drawMax = maxVal + padding;
    const drawMin = minVal - padding;
    const drawRange = Math.max(drawMax - drawMin, 0.1);

    const getY = (val) => 170 - ((val - drawMin) / drawRange) * 150;
    const getPoints = (key) => prompt.data.map((d, i) => `${40 + i * (340 / (prompt.data.length - 1))},${getY(d[key] || 0)}`).join(' ');

    const zeroY = getY(0);

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="flex gap-4 mb-4 text-[10px] font-bold">
          {prompt.labels.l1 && <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500"></div> {prompt.labels.l1}</div>}
          {prompt.labels.l2 && <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-green-500"></div> {prompt.labels.l2}</div>}
          {prompt.labels.l3 && <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-slate-400"></div> {prompt.labels.l3}</div>}
        </div>
        <svg viewBox="0 0 400 200" className="w-full h-full max-h-[300px]">
          {drawMin < 0 && drawMax > 0 && <line x1="40" y1={zeroY} x2="380" y2={zeroY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2" />}
          
          <path d={`M ${getPoints('v1')}`} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          {prompt.labels.l2 && <path d={`M ${getPoints('v2')}`} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />}
          {prompt.labels.l3 && <path d={`M ${getPoints('v3')}`} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4" />}
          
          <line x1="40" y1="20" x2="40" y2="170" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="40" y1="170" x2="380" y2="170" stroke="#cbd5e1" strokeWidth="1" />
          
          {prompt.data.map((d, i) => <text key={i} x={40 + i * (340 / (prompt.data.length - 1))} y="185" fontSize="8" textAnchor="middle" fill="#64748b">{d.year}</text>)}
          
          <text x="35" y={getY(maxVal)} fontSize="8" textAnchor="end" fill="#94a3b8">{maxVal.toFixed(1)}</text>
          <text x="35" y={getY(minVal)} fontSize="8" textAnchor="end" fill="#94a3b8">{minVal.toFixed(1)}</text>
        </svg>
      </div>
    );
  }

  if (prompt.graphic === 'table') {
    return (
      <div className="w-full p-6">
        <table className="w-full border-collapse rounded-lg overflow-hidden border border-slate-200">
          <thead>
            <tr className="bg-slate-800 text-white text-xs">
              {prompt.headers.map((h, i) => <th key={i} className="p-2 text-left uppercase tracking-tighter">{h}</th>)}
            </tr>
          </thead>
          <tbody className="text-xs">
            {prompt.data.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="p-2 font-bold border-b text-slate-700">{row.country || row.region}</td>
                <td className="p-2 border-b text-slate-600">{row.y1}</td>
                <td className="p-2 border-b text-slate-600">{row.y2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (prompt.graphic === 'pie') {
    let currentAngle = 0;
    return (
      <div className="w-full h-full flex flex-col md:flex-row items-center justify-center p-6 gap-6">
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
  return null;
};

const getSystemPrompt = (writingTask, prompt) => {
  if (writingTask === 'task2') {
    return `You are an expert IELTS Writing Examiner.
    Mark this IELTS Writing Task 2 essay accurately, but explain your feedback using clear student-friendly language.
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

    CRITICAL FEEDBACK LENGTH INSTRUCTION:
    Keep each criterion explanation to 1-2 concise sentences.
    Keep tips brief and practical.

    CRITICAL INSTRUCTION FOR DIAGNOSTIC TAGS (TOP 3 FOCUS AREAS):
    Return only the 3 most important focus areas in "diagnostic_tags" (maximum 3 tags).
    Prioritize higher-order writing quality first (Task Response quality, argument development, coherence, and paragraph logic).
    Do NOT let minor article/preposition mistakes dominate the top 3 unless frequent and meaning-changing.
    Use ONLY the exact 20 tags below.
    Nouns & Mechanics: Article Usage, Countability & Plurals, Pronoun Reference, Prepositional Accuracy, Word Forms
    Verbs & Time: Subject-Verb Agreement, Tense Consistency, Present Perfect vs. Past Simple, Gerunds vs. Infinitives, Passive Voice Construction
    Sentence Architecture: Sentence Boundaries (Fragments/Comma Splices), Relative Clauses, Subordination, Word Order, Parallel Structure
    Academic Discourse: Transitional Devices, Collocations, Academic Register, Nominalization, Hedging

    CRITICAL INSTRUCTION FOR INLINE MAJOR ERRORS:
    Return a "major_errors" array with up to 5 items.
    Each item must include:
    - original_snippet: exact quote copied from the student's response (character-for-character)
    - correction: improved wording
    - explanation: one short reason in simple language
    Include only major errors that most affect band score clarity or accuracy.`;
  }

  return `You are a helpful IELTS Writing Examiner and expert EAP evaluator for beginner and intermediate students.
    Mark this Academic Task 1 response accurately, but explain your feedback using very simple, clear language.
    Prompt: ${prompt.instruction}.
    Data Points: ${JSON.stringify(prompt.data)}.
    Evaluate Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range and Accuracy.
    Assign a Band Score between 0 and 9.

    CRITICAL FEEDBACK LENGTH INSTRUCTION:
    Your explanations for the four criteria (Task Achievement, Coherence, Lexical, Grammar) MUST be extremely short. Limit each explanation to exactly 1 or 2 simple sentences maximum. Students need to be able to scan your feedback quickly. Avoid complex examiner jargon.

    Your tips must also be short and punchy.

    CRITICAL INSTRUCTION FOR DIAGNOSTIC TAGS (TOP 3 FOCUS AREAS):
    Return only the 3 most important focus areas in "diagnostic_tags" (maximum 3 tags).
    Prioritize higher-order Task 1 performance first: Task Achievement quality, clear comparisons, coherence, and academic expression.
    Do NOT let minor grammar dominate. If Article Usage and Prepositional Accuracy are both minor issues, include at most one of them unless these errors are frequent and meaning-changing.
    In addition to your written feedback, analyze the text using ONLY the exact 20 tags below. Do not create new tags.
    Nouns & Mechanics: Article Usage, Countability & Plurals, Pronoun Reference, Prepositional Accuracy, Word Forms
    Verbs & Time: Subject-Verb Agreement, Tense Consistency, Present Perfect vs. Past Simple, Gerunds vs. Infinitives, Passive Voice Construction
    Sentence Architecture: Sentence Boundaries (Fragments/Comma Splices), Relative Clauses, Subordination, Word Order, Parallel Structure
    Academic Discourse: Transitional Devices, Collocations, Academic Register, Nominalization, Hedging

    CRITICAL INSTRUCTION FOR INLINE MAJOR ERRORS:
    Return a "major_errors" array with up to 5 items.
    Each item must include:
    - original_snippet: exact quote copied from the student's response (character-for-character)
    - correction: improved wording
    - explanation: one short reason in simple language
    Include only major errors that most affect band score clarity or accuracy.`;
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

    const tooltip = `Correction: ${segment.error.correction || 'See examiner suggestion'}\nWhy: ${segment.error.explanation || 'This pattern may lower your band score.'}`;
    return (
      <span
        key={idx}
        title={tooltip}
        className="text-red-700 underline decoration-red-500 decoration-2 underline-offset-2 font-semibold cursor-help"
      >
        {segment.text}
      </span>
    );
  });
};

// Moving API call logic outside component for clarity and to avoid closure issues
const callGeminiWithRetry = async (payload, systemPrompt, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  const modelName = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: payload }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json",
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
                }
              },
              required: ["bandScore", "taskAchievement", "coherenceCohesion", "lexicalResource", "grammarAccuracy", "improvementTips", "modelHighlights", "diagnostic_tags", "major_errors"]
            }
          }
        })
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         throw new Error(`HTTP ${response.status}: ${JSON.stringify(errData)}`);
      }
      
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No content in AI response");
      return JSON.parse(content);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

export default function App() {
  const [writingTask, setWritingTask] = useState(forcedWritingTask || 'task1');
  const [currentPrompt, setCurrentPrompt] = useState(() => {
    const initialTask = forcedWritingTask || 'task1';
    const pool = initialTask === 'task2' ? TASK_2_PROMPTS : TASK_1_PROMPTS;
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
  const minWordTarget = writingTask === 'task2' ? 250 : 150;

  const getPromptPool = (taskType) => (taskType === 'task2' ? TASK_2_PROMPTS : TASK_1_PROMPTS);
  const getRandomPrompt = (taskType) => {
    const pool = getPromptPool(taskType);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const switchWritingTask = (taskType) => {
    if (forcedWritingTask) return;
    setWritingTask(taskType);
    setCurrentPrompt(getRandomPrompt(taskType));
    setText('');
    setFeedback(null);
    setView('bank');
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

  const [saveMessage, setSaveMessage] = useState("");

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

    const systemPrompt = getSystemPrompt(writingTask, currentPrompt);

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
          module_type: 'writing',
          taskId: Number.isInteger(taskIdNum) ? taskIdNum : undefined
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
      setErrorMessage(`Connection Busy: The AI service is currently overloaded. Please try submitting again.`);
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('bank')}>
            <img src="/logo.png" alt="Hayford Logo" className="w-10 h-10 object-contain mx-auto" />
            <div><h1 className="font-bold text-lg leading-none text-slate-900">IELTS Master</h1><p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Marking Suite</p></div>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${timeLeft < 300 && hasStarted ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <Clock size={16} /><span className="font-mono font-bold text-lg">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span>
          </div>
          <button onClick={() => setView("bank")} className="text-sm font-bold text-slate-500 hover:text-amber-600 flex items-center gap-2 bg-white px-3 py-1.5 border rounded-lg transition-colors"><BookOpen size={16} /> Bank</button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:text-red-600 flex items-center gap-2 transition-colors"><LogOut size={16} /> Logout</button>
        </div>
      </header>

      <div className="px-6 pt-4 bg-slate-50 border-b border-slate-200">
        {!forcedWritingTask && (
          <div className="max-w-md mx-auto bg-white p-1 rounded-xl border border-slate-200 flex gap-1">
            <button
              onClick={() => switchWritingTask('task1')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${writingTask === 'task1' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Task 1: Academic Report
            </button>
            <button
              onClick={() => switchWritingTask('task2')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${writingTask === 'task2' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Task 2: Essay
            </button>
          </div>
        )}
        {forcedWritingTask && (
          <div className="max-w-md mx-auto bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 text-center">
            Assigned Mode: {forcedWritingTask === 'task2' ? 'Task 2 Essay' : 'Task 1 Academic Report'}
          </div>
        )}
      </div>
      
      <main className="flex-1 overflow-hidden">
        {view === "bank" ? (
          <PromptList onSelect={startPractice} prompts={getPromptPool(writingTask)} writingTask={writingTask} />
        ) : view === "feedback" ? (
          <FeedbackView 
            feedback={feedback} 
            writingTask={writingTask}
            originalText={text} 
            saveMessage={saveMessage}
            onReset={() => setView("bank")} 
            onNextRandom={() => startPractice(getRandomPrompt(writingTask))}
          />
        ) : (
          <div className="h-full flex flex-col lg:flex-row">
            {/* Visual Panel */}
            <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-r bg-white scrollbar-hide">
              <div className="max-w-xl mx-auto">
                <div className="flex items-center gap-2 text-slate-900 mb-2">{getIcon(currentPrompt.type)}<span className="font-black uppercase tracking-widest text-[10px]">{currentPrompt.type}</span></div>
                <h2 className="text-2xl font-black mb-4 text-slate-800 tracking-tight">{currentPrompt.title}</h2>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 mb-8 text-slate-600 leading-relaxed font-medium italic">"{currentPrompt.instruction}"</div>
                {writingTask === 'task1' ? (
                  <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden mb-8 min-h-[350px] flex flex-col">
                    <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Visual Data View</span><span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">TASK 1</span></div>
                    <div className="flex-1 flex items-center justify-center p-4">
                      <div className="bg-white text-slate-900 p-4 rounded-xl w-full">
                        <VisualRenderer prompt={currentPrompt} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-8 text-sm text-indigo-900 leading-relaxed">
                    <p className="font-bold mb-1">Task 2 Essay Focus</p>
                    <p>Present a clear position, organize ideas into logical body paragraphs, and support points with relevant reasoning or examples.</p>
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-900 flex gap-3"><AlertTriangle size={18} className="shrink-0 text-amber-500" /><p><b>Note:</b> {TASK_INSTRUCTIONS[writingTask]}</p></div>
              </div>
            </div>

            {/* Writing Panel */}
            <div className="w-full lg:w-1/2 flex flex-col bg-slate-50">
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex justify-between items-center mb-2 px-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Your Response</span><span className={`text-[10px] font-black uppercase ${getWordCount(text) < minWordTarget ? 'text-amber-500' : 'text-green-500'}`}>{getWordCount(text)} words</span></div>
                <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 leading-relaxed">
                  <span className="font-bold">IELTS {writingTask === 'task1' ? 'Task 1' : 'Task 2'} Instruction:</span> {TASK_INSTRUCTIONS[writingTask]}
                </div>
                <textarea className="flex-1 w-full p-8 rounded-2xl border border-slate-200 shadow-sm focus:ring-4 focus:ring-slate-200 outline-none text-lg leading-relaxed resize-none font-serif placeholder:text-slate-300 transition-all" placeholder={writingTask === 'task1' ? 'The chart illustrates...' : 'It is often argued that...'} value={text} onChange={handleTextChange} disabled={isLoading} />
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

function FeedbackView({ feedback, writingTask, originalText, saveMessage, onReset, onNextRandom }) {
  if (!feedback) return null;
  const focusTags = Array.isArray(feedback.diagnostic_tags) ? feedback.diagnostic_tags.slice(0, 3) : [];

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
            <div className="bg-amber-50/50 rounded-2xl p-8 border border-amber-100 h-fit">
              <h3 className="text-sm font-black mb-6 flex items-center gap-2 text-amber-900 uppercase"><Settings size={18} /> Examiner Advice</h3>
              <div className="space-y-4">{feedback.improvementTips.map((tip, idx) => (<div key={idx} className="flex gap-4 items-start"><div className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center shrink-0 text-[10px] font-black">{idx + 1}</div><p className="text-sm text-amber-900 leading-relaxed font-medium">{tip}</p></div>))}</div>
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
                            href={`/grammar-lab/?topicId=${mappedTopicId}`}
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
          <div className="flex flex-col sm:flex-row gap-4">
             <button onClick={onReset} className="flex-1 bg-white border-2 border-slate-900 text-slate-900 py-5 rounded-2xl font-black hover:bg-slate-50 transition-all shadow-sm tracking-widest uppercase text-xs">Back to Question Bank</button>
             <button onClick={onNextRandom} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black hover:bg-black transition-all shadow-xl tracking-widest uppercase text-xs">Next Random Topic</button>
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
