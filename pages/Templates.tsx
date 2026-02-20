
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutTemplate, ShoppingCart, LayoutDashboard, MessageSquare, 
  Globe, Smartphone, Database, Zap, ArrowRight, GitBranch, Shield 
} from 'lucide-react';
import { Card, Button, Badge } from '../components/UI';

interface Template {
  id: string;
  title: string;
  description: string;
  type: 'web' | 'app' | 'bot' | 'software';
  icon: any;
  stack: string[];
  complexity: 'Low' | 'Medium' | 'High';
  features: string[];
}

const TEMPLATES: Template[] = [];

const Templates = () => {
  const navigate = useNavigate();

  const handleUseTemplate = (template: Template) => {
    const newProject = {
      id: Date.now().toString(),
      name: `${template.title} Project`,
      description: `Based on template: ${template.title}. ${template.description} Tech Stack: ${template.stack.join(', ')}.`,
      type: template.type,
      createdAt: Date.now(),
      status: 'active',
      isTemplate: true
    };

    // Save to local storage
    const existing = JSON.parse(localStorage.getItem('projects') || '[]');
    localStorage.setItem('projects', JSON.stringify([newProject, ...existing]));
    localStorage.setItem('currentProject', JSON.stringify(newProject));

    // Navigate to planning to customize or build
    navigate('/planning');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutTemplate className="text-orange-500" /> Project Templates
        </h1>
        <p className="text-zinc-400 max-w-2xl">
          Jumpstart your development with pre-architected solutions. These templates come with built-in best practices, folder structures, and CI/CD configurations.
        </p>
      </div>

      {TEMPLATES.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
            <LayoutTemplate size={32} />
          </div>
          <div>
            <h3 className="text-xl font-medium text-white">No templates available yet</h3>
            <p className="text-zinc-500 max-w-sm mx-auto mt-2">
              Check back later for new project templates to jumpstart your development.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map((template) => (
            <Card key={template.id} className="group relative flex flex-col h-full hover:border-orange-500/50 transition-all duration-300">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button onClick={() => handleUseTemplate(template)} className="h-8 px-3 text-xs">
                  Use Template <ArrowRight size={14} />
                </Button>
              </div>

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-colors">
                  <template.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{template.title}</h3>
                <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                  {template.description}
                </p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex flex-wrap gap-2">
                  {template.stack.map(tech => (
                    <span key={tech} className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-300">
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                     <Zap size={14} className={template.complexity === 'High' ? 'text-red-400' : template.complexity === 'Medium' ? 'text-amber-400' : 'text-green-400'} />
                     <span>{template.complexity} Complexity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <Shield size={14} className="text-blue-400" />
                     <span>Production Ready</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Templates;
