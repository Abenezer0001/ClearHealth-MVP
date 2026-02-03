import { cn } from "@/lib/utils";
import { Check, Loader2, FileText, Brain, Search, MessageSquare } from "lucide-react";

type Step = {
  id: string;
  label: string;
  icon: typeof FileText;
};

const steps: Step[] = [
  { id: "ingest", label: "Ingesting", icon: FileText },
  { id: "claims", label: "Extracting Claims", icon: Brain },
  { id: "risk", label: "Assessing Risk", icon: Search },
  { id: "response", label: "Generating Response", icon: MessageSquare },
];

interface AnalysisStepperProps {
  currentStep: string;
  completedSteps: string[];
  status: string;
}

export function AnalysisStepper({ currentStep, completedSteps, status }: AnalysisStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPending = !isCompleted && !isCurrent;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10 text-primary",
                  isPending && "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isCurrent && status === "running" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium text-center",
                  isCompleted && "text-primary",
                  isCurrent && "text-foreground",
                  isPending && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mt-[-24px]",
                  index < currentIndex ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
