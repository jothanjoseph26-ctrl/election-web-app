import { AdvancedSearch } from '@/components/AdvancedSearch';
import { useNavigate } from 'react-router-dom';
import { SearchResult } from '@/services/search.service';
import { useToast } from '@/hooks/use-toast';

export default function SearchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleResultSelect = (result: SearchResult) => {
    switch (result.type) {
      case 'agent':
        navigate(`/agents?highlight=${result.id}`);
        break;
      case 'report':
        navigate('/reports');
        toast({
          title: 'Navigating to Reports',
          description: 'Report will be highlighted in the reports list',
        });
        break;
      case 'broadcast':
        navigate('/broadcasts');
        toast({
          title: 'Navigating to Broadcasts',
          description: 'Broadcast will be highlighted in the list',
        });
        break;
      default:
        toast({
          title: 'Unknown result type',
          description: 'Unable to navigate to this result',
          variant: 'destructive',
        });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <AdvancedSearch onResultSelect={handleResultSelect} />
    </div>
  );
}