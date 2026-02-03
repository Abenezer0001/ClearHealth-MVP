import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, MessageSquare, FileText, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneratedOutput } from "@shared/schema";

interface OutputPanelProps {
  outputs: GeneratedOutput[];
  disclaimer: string | null;
  whatIsWrong: string | null;
  whatWeKnow: string | null;
  whatToDo: string | null;
  whenToSeekCare: string | null;
}

const formatIcons = {
  social_reply: MessageSquare,
  handout: FileText,
  clinician_note: Stethoscope,
};

const formatLabels = {
  social_reply: "Social Reply",
  handout: "Patient Handout",
  clinician_note: "Clinician Note",
};

const lengthLabels = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export function OutputPanel({
  outputs,
  disclaimer,
  whatIsWrong,
  whatWeKnow,
  whatToDo,
  whenToSeekCare,
}: OutputPanelProps) {
  const [format, setFormat] = useState<string>("social_reply");
  const [length, setLength] = useState<string>("short");
  const [copied, setCopied] = useState(false);

  const currentOutput = outputs.find(
    (o) => o.format === format && o.length === length
  );

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Counter-Message Pack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {disclaimer && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-300">
              {disclaimer}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {whatIsWrong && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">What's Wrong / Missing</h4>
                <p className="text-sm">{whatIsWrong}</p>
              </div>
            )}
            {whatWeKnow && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">What We Know</h4>
                <p className="text-sm">{whatWeKnow}</p>
              </div>
            )}
            {whatToDo && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">What To Do Now</h4>
                <p className="text-sm">{whatToDo}</p>
              </div>
            )}
            {whenToSeekCare && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">When to Seek Care</h4>
                <p className="text-sm">{whenToSeekCare}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Generated Responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Format</span>
              <div className="flex gap-2">
                {Object.entries(formatLabels).map(([key, label]) => {
                  const Icon = formatIcons[key as keyof typeof formatIcons];
                  return (
                    <Button
                      key={key}
                      variant={format === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormat(key)}
                      className="gap-1.5"
                      data-testid={`button-format-${key}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Length</span>
              <div className="flex gap-2">
                {Object.entries(lengthLabels).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={length === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLength(key)}
                    data-testid={`button-length-${key}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {currentOutput ? (
            <div className="relative">
              <div className="p-4 bg-muted/50 rounded-md border">
                <p className="text-sm whitespace-pre-wrap">{currentOutput.content}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 gap-1.5"
                onClick={() => handleCopy(currentOutput.content)}
                data-testid="button-copy-output"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No output available for this combination.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
