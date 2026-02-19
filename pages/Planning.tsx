
import React, { useEffect, useState } from 'react';
import { Map, Loader2, CheckCircle2, Search, ArrowRight, RefreshCw, ChevronLeft, Download, FileText } from 'lucide-react';
import { Card, Button, Badge } from '../components/UI';
import { generateProjectPlan, conductMarketResearch } from '../services/geminiService';
import { Link, useNavigate } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { Project } from '../types';

const Planning = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string>('');
  const [research, setResearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'analyzing' | 'researching' | 'planning' | 'done'>('analyzing');
  
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('currentProject');
      if (!stored) {
          navigate('/projects');
          return;
      }
      const project: Project = JSON.parse(stored);

      // Avoid re-running if plan exists in memory or local storage
      const storedPlan = localStorage.getItem('currentPlan');
      if (storedPlan) {
          setPlan(storedPlan);
          setLoading(false);
          setStep('done');
          // Optionally fetch research if missing
          return;
      }

      // Step 1: Research
      setStep('researching');
      const researchData = await conductMarketResearch(project.description);
      setResearch(researchData);
      
      // Step 2: Plan
      setStep('planning');
      const planData = await generateProjectPlan(project.description, project.type);
      setPlan(planData);
      
      // Save for next steps
      localStorage.setItem('currentPlan', planData);
      
      setStep('done');
      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleExportMarkdown = () => {
    const blob = new Blob([plan], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-plan.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 h-full flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <button 
             onClick={() => navigate('/build')}
             className="text-zinc-500 hover:text-white flex items-center gap-1 mb-2 text-sm transition-colors"
          >
             <ChevronLeft size={16} /> Back to Builder
          </button>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Map className="text-orange-500" /> Project Planner
          </h1>
          <p className="text-zinc-400 mt-1">
            {loading ? 'AI Architect "Rohit" is analyzing your requirements...' : 'Review your architectural roadmap.'}
          </p>
        </div>
      </div>

      {loading && (
        <Card className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse border-dashed border-zinc-800 bg-zinc-900/50">
          <Loader2 className="animate-spin text-orange-500" size={48} />
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-medium text-white">
              {step === 'analyzing' && "Analyzing Project Scope..."}
              {step === 'researching' && "Conducting Market Research (Vikram)..."}
              {step === 'planning' && "Designing Architecture (Rohit)..."}
            </h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              Using Gemini 3.0 Thinking Mode to architect a robust solution before coding.
            </p>
          </div>
        </Card>
      )}

      {/* Main Plan View */}
      {!loading && (
        <div className="space-y-6 animate-fade-in">
           <div className="flex justify-end">
             <Link to="/chat">
                <Button>Start Coding <ArrowRight size={18} /></Button>
             </Link>
           </div>

          {/* Research Section */}
          {research && (
            <Card className="border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 mb-4">
                <Search className="text-purple-400" size={20} />
                <h2 className="text-xl font-bold text-white">Market Intelligence</h2>
                <Badge color="purple">Grounding Data</Badge>
              </div>
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                <Markdown text={research} />
              </div>
            </Card>
          )}

          {/* Main Plan Section */}
          {plan && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                    <CheckCircle2 className="text-green-500" size={20} />
                    <h2 className="text-xl font-bold text-white">Execution Plan</h2>
                    <Badge color="green">Architect Approved</Badge>
                  </div>
                  <Markdown text={plan} />
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="sticky top-4">
                  <h3 className="font-bold text-white mb-4">Actions</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => window.print()}>
                      <Download size={16} className="mr-2" /> Export to PDF
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={handleExportMarkdown}>
                      <FileText size={16} className="mr-2" /> Export to Markdown
                    </Button>
                    
                    <div className="border-t border-zinc-800 my-4"></div>
                    
                    <p className="text-xs text-zinc-500 mb-2">
                      Not satisfied? Regenerate the plan with different parameters.
                    </p>
                    <Button 
                      variant="secondary" 
                      className="w-full"
                      onClick={() => {
                        localStorage.removeItem('currentPlan');
                        window.location.reload();
                      }}
                    >
                      <RefreshCw size={16} /> Regenerate
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Planning;
