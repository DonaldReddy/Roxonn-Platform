import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, MessageCircle } from "lucide-react";

export default function FAQPage() {
  // Get the hash from URL to scroll to specific section
  React.useEffect(() => {
    // Check if there's a hash in the URL
    if (window.location.hash) {
      // Find the element with the corresponding id
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        // Scroll to the element
        element.scrollIntoView({ behavior: 'smooth' });
        
        // Add a highlight effect
        element.classList.add('highlight-section');
        setTimeout(() => {
          element.classList.remove('highlight-section');
        }, 2000);
      }
    }
  }, []);
  const faqCategories = [
    {
      title: "General Platform Questions",
      items: [
        {
          question: "What is ROXONN?",
          answer:
            "ROXONN is a decentralized platform that integrates GitHub repositories with the XDC blockchain, allowing repository owners to reward contributors with tokens for their work on issues and pull requests.",
        },
        {
          question: "Why does the platform show \"Beta\" in the navigation bar?",
          answer:
            "The platform is currently in beta testing phase, which means we're still refining features and functionality based on user feedback before a full production release.",
        },
        {
          question: "Is this platform free to use?",
          answer:
            "The platform itself is free to use. However, blockchain transactions may require small gas fees on the XDC network.",
        },
      ],
    },
    {
      title: "Blockchain & Tokens",
      items: [
        {
          question: "What blockchain does the platform use?",
          answer:
            "The platform operates on the XDC Mainnet, which is the production environment for the XDC blockchain.",
        },
        {
          question: "Are the tokens on the platform real?",
          answer:
            "Yes, all tokens on the platform represent real value as we're operating on the XDC Mainnet.",
        },
        {
          question: "How do I get XDC tokens?",
          answer:
            "You can obtain XDC tokens from various cryptocurrency exchanges that support the XDC Network.",
        },
        {
          question: "When will the ROXONN token launch take place?",
          answer:
            "The date for the official ROXONN token launch will be announced on our platform and social media channels. After launch, tokens earned on the platform will have real value.",
        },
      ],
    },
    {
      title: "Account & Wallet",
      items: [
        {
          question: "How do I create an account?",
          answer:
            "You can sign up using your GitHub account, which will authenticate you and create a linked XDC wallet on our platform.",
        },
        {
          question: "Is my GitHub data secure on the platform?",
          answer:
            "Yes, we only access the GitHub data necessary for platform functionality and comply with GitHub's security policies and OAuth scopes.",
        },
        {
          question: "How is my wallet created and managed?",
          answer:
            "A XDC wallet is automatically generated for you during the registration process. The wallet is secured and managed through our platform's integration with the blockchain.",
        },
        {
          question: "Can I connect my existing XDC wallet instead of creating a new one?",
          answer:
            "Currently, the platform generates a new wallet for each user, but we're working on functionality to allow connecting existing wallets in future updates.",
        },
      ],
    },
    {
      title: "Repository Management",
      items: [
        {
          question: "How do I add my GitHub repository to the platform?",
          answer:
            "After signing in, you can navigate to the Repositories page and add your GitHub repositories to the platform with a few clicks.",
        },
        {
          question: "Who can manage rewards for a repository?",
          answer:
            "Repository owners and designated pool managers can add funds to the repository reward pool and allocate rewards to specific issues.",
        },
        {
          question: "How do I add funds to my repository's reward pool?",
          answer:
            "On your repository's details page, you can add XDC tokens to the reward pool by entering the amount and confirming the transaction.",
        },
      ],
    },
    {
      title: "Issue Rewards",
      items: [
        {
          question: "How do I set rewards for specific issues?",
          answer:
            "Repository managers can allocate tokens from the repository's reward pool to specific issues by entering the issue number and the reward amount.",
        },
        {
          question: "How are rewards distributed to contributors?",
          answer:
            "When a contributor's pull request for an issue is accepted and merged, the system automatically triggers the reward distribution to their wallet.",
        },
        {
          question: "Can I modify a reward after it's been set?",
          answer:
            "Yes, as a repository manager, you can modify rewards for issues as long as they haven't been claimed yet.",
        },
      ],
    },
    {
      title: "Technical Questions",
      items: [
        {
          question: "What happens if the blockchain transaction fails during reward distribution?",
          answer:
            "The system will retry failed transactions. If issues persist, you can contact support for manual intervention.",
        },
        {
          question: "Is my code contribution evaluated before rewards are distributed?",
          answer:
            "The platform relies on the repository owner's decision to merge a pull request as verification of valuable contribution. The reward is distributed when the PR is merged.",
        },
        {
          question: "How does the platform verify GitHub contributions?",
          answer:
            "The platform integrates with GitHub's API to verify issue creation, pull request submissions, and merge events for accurate reward distribution.",
        },
      ],
    },
    {
      title: "Troubleshooting",
      items: [
        {
          question: "Why is my reward not showing in my wallet?",
          answer:
            "Blockchain transactions may take some time to process. If a reward hasn't appeared after 15 minutes, check the transaction status in your profile and contact support if needed.",
        },
        {
          question: "What should I do if I encounter errors while using the platform?",
          answer:
            "Most errors can be resolved by refreshing the page or signing out and back in. For persistent issues, please reach out to our support team.",
        },
        {
          question: "How can I report a bug or request a feature?",
          answer:
            "You can submit bug reports or feature requests through the platform's Help & Guides section or by contacting our support team directly.",
        },
      ],
    },
    {
      title: "Pool Manager Guide",
      id: "pool-manager",
      items: [
        {
          question: "What is a Pool Manager?",
          answer:
            "A Pool Manager is a GitHub repository owner or administrator who can add funds to their repository's reward pool and allocate those funds to specific issues. Pool Managers are responsible for incentivizing contributors and distributing rewards for completed work.",
        },
        {
          question: "How do I become a Pool Manager?",
          answer:
            "When signing up for ROXONN, select 'Pool Manager' as your role. You'll need to have admin permissions on the GitHub repositories you want to manage rewards for.",
        },
        {
          question: "Which repositories can I manage?",
          answer:
            "You can only manage repositories where you have administrator permissions on GitHub. When funding a repository, the system verifies your admin status through the GitHub API before allowing the transaction.",
        },
        {
          question: "How do I fund a repository?",
          answer:
            "Navigate to your profile page to see your GitHub repositories, or visit the repository details page and click on the 'Rewards' tab. Enter the amount of ROXN tokens you want to add to the repository pool and confirm the transaction. A small platform fee (3%) will be deducted from the funding amount.",
        },
        {
          question: "How do I allocate rewards to issues?",
          answer:
            "On the repository details page, find the issue you want to incentivize and click 'Set Reward'. Enter the reward amount and confirm. Contributors will see this reward and can work on the issue to earn it.",
        },
        {
          question: "Can I add funds to repositories I don't own?",
          answer:
            "No. For security reasons, you can only fund repositories where you have administrator permissions on GitHub. This prevents unauthorized funding activities.",
        },
        {
          question: "What fees are charged when funding a repository?",
          answer:
            "When funding a repository, a 3% platform fee is deducted from the total amount. This fee supports ongoing development and maintenance of the ROXONN platform.",
        },
        {
          question: "How do contributors claim their rewards?",
          answer:
            "Once a contributor completes an issue, they can submit a pull request. After the PR is approved and merged, you (as the Pool Manager) can distribute the reward to the contributor through the platform.",
        },
      ],
    },
    {
      title: "Future Plans",
      items: [
        {
          question: "Will the platform support other blockchains beyond XDC?",
          answer:
            "Future updates may include support for additional blockchain networks, which will be announced as they become available.",
        },
        {
          question: "Are there plans to add more GitHub integration features?",
          answer:
            "Yes, we are continuously working on enhancing GitHub integration with features like automatic issue detection, contribution metrics, and more comprehensive reward management tools.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about the ROXONN platform, blockchain integration, and rewards system.
        </p>
      </div>

      <div className="rounded-md bg-yellow-500/10 p-3 border border-yellow-500/30">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <div className="text-sm font-medium text-yellow-500">Testnet Environment</div>
        </div>
        <p className="text-xs text-yellow-600 mt-1">
          This platform is currently running on the Apothem XDC Testnet. All token rewards are currently test tokens with no real value. 
          Post ROXONN token launch, these will be replaced with tokens having real value.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {faqCategories.map((category, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="bg-muted/50 pb-4" id={category.id}>
                <CardTitle>{category.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, j) => (
                    <AccordionItem key={j} value={`item-${i}-${j}`}>
                      <AccordionTrigger className="text-left font-medium">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Beta Platform</CardTitle>
              <CardDescription>
                ROXONN is currently in beta testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Badge variant="outline" className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 border-violet-500/30 text-xs uppercase font-bold tracking-wide px-2 py-1">
                  Beta
                </Badge>
                <p className="text-sm text-muted-foreground">
                  We're constantly improving the platform based on user feedback. Your experience helps us make ROXONN better!
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Need More Help?</CardTitle>
              <CardDescription>
                We're here to support you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  If you couldn't find the answer to your question, chat with our support team or email us at <span className="text-primary font-medium">connect@roxonn.com</span>
                </p>
                <Button 
                  variant="outline" 
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => {
                    if (window.$zoho && window.$zoho.salesiq && window.$zoho.salesiq.floatwindow) {
                      window.$zoho.salesiq.floatwindow.visible('show');
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat with Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alert at the bottom of the page */}
      <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-violet-500" />
          <div className="text-sm font-medium text-violet-500">Mainnet Environment</div>
        </div>
        <p className="text-sm">
          This platform is running on the XDC Mainnet. All token rewards represent real value. Please handle with care.
        </p>
      </div>
    </div>
  );
} 