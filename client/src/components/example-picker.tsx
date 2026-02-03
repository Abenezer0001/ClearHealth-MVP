import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, ChevronDown } from "lucide-react";

const examples = [
  {
    title: "Antibiotics for Flu",
    content: "You should take antibiotics to treat the flu - they'll help you recover faster and prevent complications.",
    category: "antibiotics",
  },
  {
    title: "Vaccines Cause Autism",
    content: "Studies have proven that childhood vaccines, especially MMR, cause autism in children. Many parents have seen this happen.",
    category: "vaccines",
  },
  {
    title: "Miracle Cancer Cure",
    content: "Drinking a special alkaline water and taking high-dose vitamin C can cure any type of cancer naturally without chemotherapy.",
    category: "miracle_cure",
  },
  {
    title: "Blood Pressure Myth",
    content: "If your blood pressure is normal on medication, you can stop taking it because you're cured. The medication fixed the problem.",
    category: "chronic",
  },
  {
    title: "Infant Hydration",
    content: "Babies under 6 months should drink extra water, especially in hot weather, to prevent dehydration.",
    category: "pediatrics",
  },
  {
    title: "Essential Oils Cure",
    content: "Essential oils like oregano and tea tree can replace prescription antibiotics and treat serious bacterial infections effectively.",
    category: "alternative",
  },
  {
    title: "COVID Myth",
    content: "The COVID-19 vaccine changes your DNA and can cause genetic mutations that get passed to children.",
    category: "vaccines",
  },
  {
    title: "Diabetes Reversal",
    content: "Type 1 diabetes can be completely cured by following a strict raw food diet for 30 days.",
    category: "diabetes",
  },
];

interface ExamplePickerProps {
  onSelect: (content: string) => void;
}

export function ExamplePicker({ onSelect }: ExamplePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-try-example">
          <Sparkles className="h-4 w-4" />
          Try an example
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {examples.map((example, index) => (
          <DropdownMenuItem
            key={index}
            onClick={() => onSelect(example.content)}
            className="cursor-pointer"
            data-testid={`example-${index}`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{example.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {example.content}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
