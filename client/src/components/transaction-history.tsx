import { Card } from './ui/card';
import { RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';

export function TransactionHistory() {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <Badge variant="outline">Coming Soon</Badge>
        </div>
        
        <div className="py-12 text-center">
          <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">Transaction History Coming Soon</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            We're working on implementing a comprehensive transaction history feature.
            Stay tuned for updates!  
          </p>
        </div>
      </div>
    </Card>
  );
}

// Transaction item component will be implemented when the feature is ready
