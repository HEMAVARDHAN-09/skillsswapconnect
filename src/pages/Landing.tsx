import { Link } from "react-router-dom";
import { BookOpen, Users, Award, ArrowRight, Zap, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold gradient-text">SkillSwap</h1>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost" className="font-medium">Login</Button>
            </Link>
            <Link to="/register">
              <Button className="gradient-primary font-medium">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Learn. Teach.<br />Grow Together.
          </h1>
          <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-2xl mx-auto">
            An innovative peer-to-peer skill exchange platform for students.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold text-lg px-8 py-6">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-semibold text-lg px-8 py-6">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 gradient-text">How It Works</h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">Exchange skills with peers, earn credits, and grow your knowledge network.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "Share Skills", desc: "List skills you can teach and skills you want to learn." },
              { icon: Users, title: "Get Matched", desc: "Our smart matching connects you with the perfect skill partner." },
              { icon: Award, title: "Earn Credits", desc: "Teach to earn credits, spend credits to learn — a fair exchange." },
            ].map((f, i) => (
              <div key={i} className="glass-card rounded-2xl p-8 hover-lift text-center">
                <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <f.icon className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 gradient-primary text-primary-foreground">
        <div className="container mx-auto grid md:grid-cols-3 gap-8 text-center">
          {[
            { icon: Zap, label: "Credit System", value: "Fair Exchange" },
            { icon: Star, label: "Rating System", value: "5-Star Reviews" },
            { icon: TrendingUp, label: "Leaderboard", value: "Top Performers" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <s.icon className="h-10 w-10 mb-3 opacity-80" />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-6 gradient-text">About SkillSwap</h2>
          <p className="text-lg text-muted-foreground mb-8">
            SkillSwap is a Design Thinking & Innovation project that creates a structured 
            peer-learning ecosystem within campus. Students help each other grow by exchanging 
            skills in a fair, credit-based system.
          </p>
          <Link to="/about">
            <Button variant="outline" size="lg">Learn About Our Process</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t">
        <div className="container mx-auto text-center text-muted-foreground">
          <h3 className="text-xl font-bold gradient-text mb-3">SkillSwap</h3>
          <p className="mb-4">A Design Thinking & Innovation Project</p>
          <p className="text-sm">&copy; {new Date().getFullYear()} SkillSwap. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
