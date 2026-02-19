import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Code, Cpu, Sparkles, Box, Zap, Layers } from 'lucide-react';
import { Button, Card } from '../components/UI';

const Home = () => {
  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* Fixed Full-Screen Background Container */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Massive Animated Gradient Blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-orange-600/10 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '10s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-amber-500/10 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '15s', animationDelay: '2s' }}></div>
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-zinc-800/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '20s', animationDelay: '5s' }}></div>
        
        {/* Large Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.05]" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: '50px 50px'
          }}
        ></div>

        {/* Floating Abstract Shapes positioned at the far edges */}
        <div className="absolute top-[10%] right-[5%] text-orange-500/15 animate-bounce hidden lg:block" style={{ animationDuration: '6s' }}>
          <Box size={240} strokeWidth={0.3} />
        </div>
        <div className="absolute bottom-[10%] left-[5%] text-zinc-500/10 animate-pulse hidden lg:block" style={{ animationDuration: '8s' }}>
          <Layers size={320} strokeWidth={0.2} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-24 py-20 md:py-32 px-6">
        {/* Hero Section */}
        <div className="text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-sm font-semibold tracking-wide uppercase">
            <Sparkles size={14} className="animate-spin" style={{ animationDuration: '3s' }} />
            <span>Gemini 3.0 Pro Thinking Engine</span>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-8xl font-black tracking-tight text-white leading-[1.1]">
              Build Software <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-500 via-orange-400 to-amber-200">
                At Thought Speed
              </span>
            </h1>
            <p className="text-lg md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed font-medium">
              A swarm of autonomous AI agents collaborating in real-time to plan, architect, and ship your vision.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
            <Link to="/build" className="w-full sm:w-auto">
              <Button className="h-14 px-10 text-xl w-full group shadow-[0_0_30px_rgba(249,115,22,0.2)] hover:shadow-[0_0_40px_rgba(249,115,22,0.4)]">
                Start Building <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/templates" className="w-full sm:w-auto">
              <Button variant="outline" className="h-14 px-10 text-xl w-full border-zinc-800 hover:bg-zinc-800/50 backdrop-blur-sm">
                Explore Templates
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 pb-12">
          <Card className="hover:border-orange-500/50 transition-all duration-500 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl hover:-translate-y-2">
            <div className="absolute -right-8 -top-8 text-orange-500/5 group-hover:text-orange-500/10 transition-colors">
              <Bot size={160} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                <Bot size={28} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Agentic Swarms</h3>
              <p className="text-zinc-400 leading-relaxed font-medium">
                Our specialized agent fleet works in parallel. From product logic to DevOps, every detail is covered autonomously.
              </p>
            </div>
          </Card>

          <Card className="hover:border-zinc-500/50 transition-all duration-500 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl hover:-translate-y-2">
            <div className="absolute -right-8 -top-8 text-zinc-500/5 group-hover:text-zinc-500/10 transition-colors">
              <Cpu size={160} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-zinc-500/10 flex items-center justify-center text-zinc-400 mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-inner">
                <Cpu size={28} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Deep Reasoning</h3>
              <p className="text-zinc-400 leading-relaxed font-medium">
                Powered by Gemini 3.0's Thinking Mode, we architect complex systems before generating a single line of code.
              </p>
            </div>
          </Card>

          <Card className="hover:border-amber-500/50 transition-all duration-500 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl hover:-translate-y-2">
            <div className="absolute -right-8 -top-8 text-amber-500/5 group-hover:text-amber-500/10 transition-colors">
              <Code size={160} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                <Code size={28} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Zero-Config Output</h3>
              <p className="text-zinc-400 leading-relaxed font-medium">
                Production-ready results. Export to ZIP, deploy to cloud, or push to GitHub with one click. 
              </p>
            </div>
          </Card>
        </div>

        {/* Stats / Proof Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-16 border-y border-zinc-800/50 bg-zinc-900/20 backdrop-blur-md rounded-[2.5rem] mb-20">
          <div className="text-center space-y-1">
            <div className="text-4xl md:text-5xl font-black text-white">50k+</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Deployments</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-4xl md:text-5xl font-black text-orange-500">10x</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Faster Dev Cycle</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-4xl md:text-5xl font-black text-white">99%</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Code Accuracy</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-4xl md:text-5xl font-black text-amber-400">24/7</div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Agent Uptime</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;