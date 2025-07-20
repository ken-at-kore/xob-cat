import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to XOB CAT
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          XO Bot Conversation Analysis Tools - Empowering Kore.ai Expert Services teams 
          to investigate and analyze chatbot and IVA session data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              View and explore chatbot session data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Browse through session transcripts, filter by date range, and examine 
              conversation details with full message history.
            </p>
            <Button asChild className="w-full">
              <Link href="/sessions">
                View Sessions
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
            <CardDescription>
              AI-powered session analysis and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate structured analysis of sessions using GPT-4o-mini, including 
              intent classification, outcome analysis, and drop-off insights.
            </p>
            <Button asChild className="w-full">
              <Link href="/analysis">
                Analyze Sessions
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Analytics and visualization dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View charts and metrics including Pareto analysis of intents, 
              drop-off locations, and transfer reasons.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                View Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Get started with XOB CAT in a few simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <h4 className="font-medium">View Sessions</h4>
                <p className="text-sm text-muted-foreground">
                  Start by browsing available chatbot sessions to understand the data structure.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <h4 className="font-medium">Analyze Conversations</h4>
                <p className="text-sm text-muted-foreground">
                  Use AI analysis to classify intents, outcomes, and identify drop-off patterns.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <h4 className="font-medium">Review Insights</h4>
                <p className="text-sm text-muted-foreground">
                  Explore the dashboard to visualize trends and generate actionable insights.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
