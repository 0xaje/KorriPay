import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Container,
  Grid,
} from "@korripay/ui";
import { CheckCircle, Cpu, FileCode, Layers } from "lucide-react";
import { SYSTEM_NAME } from "@korripay/shared";

const queryClient = new QueryClient();

function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <Container className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">💳</span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 tracking-wider">
              {SYSTEM_NAME.toUpperCase()}
            </span>
          </div>
          <Badge variant="success">Milestone 1 Active</Badge>
        </Container>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12">
        <Container>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-5xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              Enterprise Financial Foundation
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Monorepo bootstrapped with TurboRepo, strict typescript, Solidity compilation, pnpm,
              and Docker environments.
            </p>
          </div>

          <Grid cols={3} className="mb-12">
            <Card className="bg-slate-900/30 border-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-violet-500/10 text-violet-400 mb-2">
                  <Layers className="h-6 w-6" />
                </div>
                <CardTitle className="text-slate-100 text-lg">Shared Libraries</CardTitle>
                <CardDescription className="text-slate-400">
                  Common schemas & typings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">@korripay/shared</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">@korripay/errors</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">@korripay/ui</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">@korripay/sdk</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 border-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-indigo-500/10 text-indigo-400 mb-2">
                  <Cpu className="h-6 w-6" />
                </div>
                <CardTitle className="text-slate-100 text-lg">Backend Services</CardTitle>
                <CardDescription className="text-slate-400">
                  Microservices architectures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">settlement-engine</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">compliance</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">treasury</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">notification</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 border-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 mb-2">
                  <FileCode className="h-6 w-6" />
                </div>
                <CardTitle className="text-slate-100 text-lg">Smart Contracts</CardTitle>
                <CardDescription className="text-slate-400">Solidity workspaces</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">settlement</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">treasury</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">identity</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </Grid>

          <div className="mt-16 flex justify-center space-x-4">
            <Button variant="primary" size="lg" className="shadow-lg hover:shadow-violet-500/20">
              Explore Docs
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              View Architecture
            </Button>
          </div>
        </Container>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-500 text-xs">
        &copy; {new Date().getFullYear()} {SYSTEM_NAME}. Built with React 19, Vite, Tailwind CSS v4,
        and Turbo.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
