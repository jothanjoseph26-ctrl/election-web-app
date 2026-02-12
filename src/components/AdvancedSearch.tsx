import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, Clock, FileText, Users, Megaphone, X } from 'lucide-react';
import { AdvancedSearchService, type SearchResult } from '@/services/search.service';
import { LoadingState } from '@/components/LoadingState';
import { format } from 'date-fns';

interface AdvancedSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

export function AdvancedSearch({ onResultSelect, className }: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularTerms, setPopularTerms] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    categories: [] as string[],
    status: [] as string[],
    location: '',
    type: 'all' as 'all' | 'agent' | 'report' | 'broadcast'
  });
  const [activeTab, setActiveTab] = useState('all');

  // Load popular search terms on mount
  useEffect(() => {
    AdvancedSearchService.getPopularSearchTerms().then(setPopularTerms);
  }, []);

  // Load suggestions as user types
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        AdvancedSearchService.getSearchSuggestions(query).then(setSuggestions);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      let searchResults: SearchResult[] = [];

      if (filters.type === 'all') {
        searchResults = await AdvancedSearchService.globalSearch(query, filters);
      } else if (filters.type === 'agent') {
        searchResults = await AdvancedSearchService['searchAgents'](query, filters);
      } else if (filters.type === 'report') {
        searchResults = await AdvancedSearchService['searchReports'](query, filters);
      } else if (filters.type === 'broadcast') {
        searchResults = await AdvancedSearchService['searchBroadcasts'](query, filters);
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWardSearch = async (wardNumber: string) => {
    setLoading(true);
    try {
      const wardResults = await AdvancedSearchService.searchByWard(wardNumber);
      setResults(wardResults);
      setQuery(`Ward ${wardNumber}`);
    } catch (error) {
      console.error('Ward search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch();
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return <Users className="h-4 w-4" />;
      case 'report':
        return <FileText className="h-4 w-4" />;
      case 'broadcast':
        return <Megaphone className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getResultColor = (type: string) => {
    switch (type) {
      case 'agent':
        return 'bg-blue-100 text-blue-800';
      case 'report':
        return 'bg-green-100 text-green-800';
      case 'broadcast':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredResults = activeTab === 'all' 
    ? results 
    : results.filter(r => r.type === activeTab);

  const resultCounts = {
    all: results.length,
    agent: results.filter(r => r.type === 'agent').length,
    report: results.filter(r => r.type === 'report').length,
    broadcast: results.filter(r => r.type === 'broadcast').length,
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </CardTitle>
          <CardDescription>
            Search across agents, reports, and broadcasts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agents, reports, broadcasts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                    setShowSuggestions(false);
                  }
                }}
                className="pl-9 pr-10"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-muted first:rounded-t-md last:rounded-b-md text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Controls */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSearch} disabled={!query.trim() || loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Select value={filters.type} onValueChange={(value: any) => setFilters(prev => ({ ...prev, type: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="agent">Agents</SelectItem>
                <SelectItem value="report">Reports</SelectItem>
                <SelectItem value="broadcast">Broadcasts</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Ward number"
              value={filters.location}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filters.location) {
                  handleWardSearch(filters.location);
                }
              }}
              className="w-32"
            />
          </div>

          {/* Popular Searches */}
          {popularTerms.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Popular searches:</p>
              <div className="flex flex-wrap gap-1">
                {popularTerms.map((term, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSuggestionClick(term)}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results ({results.length})</CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({resultCounts.all})</TabsTrigger>
                <TabsTrigger value="agent">Agents ({resultCounts.agent})</TabsTrigger>
                <TabsTrigger value="report">Reports ({resultCounts.report})</TabsTrigger>
                <TabsTrigger value="broadcast">Broadcasts ({resultCounts.broadcast})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <LoadingState loading={loading}>
              <div className="space-y-3">
                {filteredResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className={`p-2 rounded-md ${getResultColor(result.type)}`}>
                      {getResultIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{result.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {result.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{result.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(result.created_at), 'MMM d, HH:mm')}
                        </div>
                        {result.metadata.ward && (
                          <span>Ward {result.metadata.ward}</span>
                        )}
                        {result.metadata.phone && (
                          <span>{result.metadata.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </LoadingState>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {query && !loading && results.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or check your spelling
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}