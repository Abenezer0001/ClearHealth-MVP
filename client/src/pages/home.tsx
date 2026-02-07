import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackgroundBeams } from "@/components/ui/background-beams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, FileText, Link as LinkIcon, AlertTriangle, Loader2, Search } from "lucide-react";
import { ExamplePicker } from "@/components/example-picker";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [inputType, setInputType] = useState<"text" | "url">("text");
  const [inputText, setInputText] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [region, setRegion] = useState("WHO");
  const [tone, setTone] = useState("neutral");
  const [audience, setAudience] = useState("general");
  const [platform, setPlatform] = useState("general");

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/analyze", {
        inputType,
        inputText: inputType === "url" ? inputUrl : inputText,
        inputUrl: inputType === "url" ? inputUrl : undefined,
        region,
        tone,
        audience,
        platform,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/analysis/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (inputType === "text" && !inputText.trim()) {
      toast({
        title: "Please enter text to analyze",
        variant: "destructive",
      });
      return;
    }
    if (inputType === "url" && !inputUrl.trim()) {
      toast({
        title: "Please enter a URL to analyze",
        variant: "destructive",
      });
      return;
    }
    analyzeMutation.mutate();
  };

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        <section className="section-shell relative overflow-hidden text-center space-y-4 py-8">
          <BackgroundBeams className="opacity-35" />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">ClearHealth</h1>
          </div>
          <p className="relative z-10 text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            Detect health misinformation and get evidence-based counter-messages. 
            Paste a claim, get the facts.
          </p>
        </section>

        <Card className="surface-panel">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-xl">Analyze Health Claims</CardTitle>
                <CardDescription>
                  Enter text or a URL containing health information to analyze
                </CardDescription>
              </div>
              <ExamplePicker onSelect={(content) => {
                setInputType("text");
                setInputText(content);
              }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "text" | "url")}>
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="text" className="gap-1.5" data-testid="tab-text">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5" data-testid="tab-url">
                  <LinkIcon className="h-4 w-4" />
                  URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <Textarea
                  placeholder="Paste the health claim or article text here...

Example: 'Taking antibiotics will help cure a cold faster.'"
                  className="min-h-[180px] text-base"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  data-testid="input-text"
                />
              </TabsContent>

              <TabsContent value="url" className="mt-4">
                <Input
                  type="url"
                  placeholder="https://example.com/health-article"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="text-base"
                  data-testid="input-url"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  We'll fetch and analyze the main content from this URL.
                </p>
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region / Guidelines</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="region" data-testid="select-region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHO">WHO (International)</SelectItem>
                    <SelectItem value="US">US (CDC/FDA)</SelectItem>
                    <SelectItem value="UK">UK (NHS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone" data-testid="select-tone">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger id="audience" data-testid="select-audience">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Public</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="clinician">Clinician</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform" data-testid="select-platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="email">Email/Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full gap-2" 
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Analyze Claims
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="section-shell flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>
            <strong>Educational use only.</strong> This tool is not a substitute for professional medical advice.
            Always consult a healthcare provider for medical concerns.
          </span>
        </div>
      </div>
    </div>
  );
}
