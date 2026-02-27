import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Heart, Target, Lightbulb, Wrench, TestTube } from "lucide-react";

const steps = [
  {
    icon: Heart,
    title: "Empathize",
    color: "from-pink-500 to-rose-500",
    content: "We surveyed 60+ students and found a significant lack of peer-learning structure. Many students had skills they wanted to share but no platform to connect with peers who needed them.",
  },
  {
    icon: Target,
    title: "Define",
    color: "from-blue-500 to-cyan-500",
    content: "Students need an organized platform to exchange skills within campus. The core problem: talented students exist everywhere, but there's no structured way to connect skill teachers with learners.",
  },
  {
    icon: Lightbulb,
    title: "Ideate",
    color: "from-yellow-500 to-orange-500",
    content: "We brainstormed multiple solutions including bulletin boards, WhatsApp groups, and dedicated apps. We chose a scalable web platform with a credit-based system to ensure fair skill exchange.",
  },
  {
    icon: Wrench,
    title: "Prototype",
    color: "from-green-500 to-emerald-500",
    content: "Developed a full-stack web application using modern technologies including React, TypeScript, and a cloud-hosted database with real-time capabilities and secure authentication.",
  },
  {
    icon: TestTube,
    title: "Test",
    color: "from-purple-500 to-violet-500",
    content: "User feedback from beta testers improved the UI, refined the credit system, and validated the smart matching algorithm. Iterative testing ensured a polished final product.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold gradient-text">SkillSwap</Link>
          <Link to="/"><Button variant="ghost"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button></Link>
        </div>
      </nav>

      <section className="py-16 px-6 gradient-primary text-primary-foreground text-center">
        <div className="container mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About the Project</h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">Our Design Thinking journey from problem to solution</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl space-y-8">
          {steps.map((step, i) => (
            <Card key={i} className="glass-card hover-lift overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className={`bg-gradient-to-br ${step.color} p-8 flex flex-col items-center justify-center md:w-48 text-white`}>
                  <step.icon className="h-10 w-10 mb-2" />
                  <span className="text-xs uppercase tracking-wider opacity-80">Step {i + 1}</span>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                </div>
                <CardContent className="flex-1 p-8 flex items-center">
                  <p className="text-muted-foreground leading-relaxed">{step.content}</p>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className="py-10 px-6 border-t text-center text-muted-foreground">
        <p className="font-bold gradient-text text-lg mb-2">SkillSwap</p>
        <p>A Design Thinking & Innovation Project</p>
      </footer>
    </div>
  );
};

export default About;
