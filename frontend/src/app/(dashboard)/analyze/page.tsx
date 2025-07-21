import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AnalyzePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analyze Sessions</h1>
        <p className="text-muted-foreground">
          AI-powered session analysis and insights
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Coming Soon</CardTitle>
          <CardDescription>
            AI-powered session analysis features are under development
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            This feature will allow you to:
          </p>
          <ul className="text-left space-y-2 max-w-md mx-auto">
            <li className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Generate structured analysis using GPT-4o-mini</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Classify intents and outcomes</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Identify drop-off patterns and locations</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Track token usage and costs</span>
            </li>
          </ul>
          
          <div className="pt-4">
            <Button variant="outline" disabled>
              Not Available Yet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 