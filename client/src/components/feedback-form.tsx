import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, HelpCircle, Send, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FeedbackFormProps {
  analysisId: number;
}

const ratingOptions = [
  { value: "helpful", label: "Helpful", icon: ThumbsUp, color: "text-emerald-600" },
  { value: "not_helpful", label: "Not Helpful", icon: ThumbsDown, color: "text-red-600" },
  { value: "missing_sources", label: "Missing Sources", icon: HelpCircle, color: "text-amber-600" },
];

export function FeedbackForm({ analysisId }: FeedbackFormProps) {
  const [rating, setRating] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/analysis/${analysisId}/feedback`, {
        rating,
        comment: comment || undefined,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Thank you for your feedback!",
        description: "Your input helps us improve.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to submit feedback",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (submitted) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">Thank you for your feedback!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Was this analysis helpful?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = rating === option.value;
            return (
              <Button
                key={option.value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setRating(option.value)}
                className={cn("gap-1.5", isSelected && option.color)}
                data-testid={`button-feedback-${option.value}`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </Button>
            );
          })}
        </div>

        {rating && (
          <>
            <Textarea
              placeholder="Additional comments (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="input-feedback-comment"
            />
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="gap-1.5"
              data-testid="button-submit-feedback"
            >
              <Send className="h-4 w-4" />
              {mutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
