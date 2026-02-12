import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchFilters {
  query: string;
  dateRange?: {
    start: string;
    end: string;
  };
  categories?: string[];
  status?: string[];
  location?: string;
}

interface SearchResult {
  id: string;
  type: 'agent' | 'report' | 'payment' | 'broadcast';
  title: string;
  description: string;
  metadata: Record<string, any>;
  relevance_score: number;
  created_at: string;
}

export class AdvancedSearchService {
  // Full-text search across all tables
  static async globalSearch(query: string, filters?: Partial<SearchFilters>): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Search agents
    const agentResults = await this.searchAgents(query, filters);
    results.push(...agentResults);

    // Search reports
    const reportResults = await this.searchReports(query, filters);
    results.push(...reportResults);

    // Search broadcasts
    const broadcastResults = await this.searchBroadcasts(query, filters);
    results.push(...broadcastResults);

    // Sort by relevance score (simplified - could be enhanced with proper ranking)
    return results.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  private static async searchAgents(query: string, filters?: Partial<SearchFilters>): Promise<SearchResult[]> {
    let dbQuery = supabase
      .from('agents')
      .select('*')
      .textSearch('full_name', query, { type: 'websearch' })
      .limit(20);

    // Apply filters
    if (filters?.status?.length) {
      dbQuery = dbQuery.in('payment_status', filters.status);
    }
    if (filters?.dateRange) {
      dbQuery = dbQuery
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end);
    }
    if (filters?.location) {
      dbQuery = dbQuery.or(`ward_name.ilike.%${filters.location}%,ward_number.ilike.%${filters.location}%`);
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(agent => ({
      id: agent.id,
      type: 'agent' as const,
      title: agent.full_name,
      description: `Agent - ${agent.ward_name || 'Ward ' + agent.ward_number} - ${agent.verification_status} - ${agent.payment_status}`,
      metadata: {
        phone: agent.phone_number,
        ward: agent.ward_name || agent.ward_number,
        verification_status: agent.verification_status,
        payment_status: agent.payment_status,
        pin: agent.pin
      },
      relevance_score: this.calculateRelevance(query, [agent.full_name, agent.phone_number || '', agent.ward_name || '']),
      created_at: agent.created_at
    }));
  }

  private static async searchReports(query: string, filters?: Partial<SearchFilters>): Promise<SearchResult[]> {
    let dbQuery = supabase
      .from('reports')
      .select(`
        *,
        agents (
          full_name,
          ward_name,
          ward_number
        )
      `)
      .textSearch('details', query, { type: 'websearch' })
      .limit(20);

    // Apply filters
    if (filters?.categories?.length) {
      dbQuery = dbQuery.in('report_type', filters.categories);
    }
    if (filters?.dateRange) {
      dbQuery = dbQuery
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end);
    }
    if (filters?.location) {
      dbQuery = dbQuery.eq('ward_number', filters.location);
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(report => ({
      id: report.id,
      type: 'report' as const,
      title: `${report.report_type.replace('_', ' ')} - ${report.agents?.full_name || 'Unknown Agent'}`,
      description: report.details.substring(0, 150) + (report.details.length > 150 ? '...' : ''),
      metadata: {
        report_type: report.report_type,
        agent_name: report.agents?.full_name,
        ward_number: report.ward_number,
        ward_name: report.agents?.ward_name,
        operator_id: report.operator_id
      },
      relevance_score: this.calculateRelevance(query, [report.details, report.report_type]),
      created_at: report.created_at
    }));
  }

  private static async searchBroadcasts(query: string, filters?: Partial<SearchFilters>): Promise<SearchResult[]> {
    let dbQuery = supabase
      .from('broadcasts')
      .select('*')
      .textSearch('message', query, { type: 'websearch' })
      .limit(20);

    // Apply filters
    if (filters?.dateRange) {
      dbQuery = dbQuery
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end);
    }
    if (filters?.categories?.length) {
      dbQuery = dbQuery.in('priority', filters.categories);
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(broadcast => ({
      id: broadcast.id,
      type: 'broadcast' as const,
      title: `Broadcast - ${broadcast.priority.toUpperCase()}`,
      description: broadcast.message.substring(0, 150) + (broadcast.message.length > 150 ? '...' : ''),
      metadata: {
        priority: broadcast.priority,
        sender_id: broadcast.sender_id
      },
      relevance_score: this.calculateRelevance(query, [broadcast.message, broadcast.priority]),
      created_at: broadcast.created_at
    }));
  }

  // Simple relevance scoring (can be enhanced with proper full-text search ranking)
  private static calculateRelevance(query: string, fields: string[]): number {
    const queryTerms = query.toLowerCase().split(' ');
    let score = 0;

    fields.forEach(field => {
      const fieldLower = field.toLowerCase();
      queryTerms.forEach(term => {
        if (fieldLower.includes(term)) {
          score += term.length / fieldLower.length; // Give higher score for longer matches
        }
      });
    });

    return score;
  }

  // Get search suggestions based on partial input
  static async getSearchSuggestions(partial: string, type?: 'agent' | 'report' | 'broadcast'): Promise<string[]> {
    if (!partial || partial.length < 2) return [];

    try {
      let suggestions: string[] = [];

      if (!type || type === 'agent') {
        const { data: agents } = await supabase
          .from('agents')
          .select('full_name, ward_name, ward_number')
          .ilike('full_name', `%${partial}%`)
          .limit(5);

        if (agents) {
          suggestions.push(...agents.map(a => a.full_name));
        }
      }

      if (!type || type === 'report') {
        const { data: reports } = await supabase
          .from('reports')
          .select('details, report_type')
          .ilike('details', `%${partial}%`)
          .limit(5);

        if (reports) {
          suggestions.push(...reports.map(r => 
            r.details.substring(0, 50) + (r.details.length > 50 ? '...' : '')
          ));
        }
      }

      return [...new Set(suggestions)].slice(0, 10);
    } catch {
      return [];
    }
  }

  // Get popular search terms
  static async getPopularSearchTerms(): Promise<string[]> {
    // This could be implemented by storing search queries in analytics
    // For now, return static common terms
    return [
      'emergency',
      'incident',
      'payment',
      'verified',
      'turnout',
      'material shortage',
      'ward',
      'agent',
      'broadcast'
    ];
  }

  // Search by location (ward-based)
  static async searchByWard(wardNumber: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Find agents in this ward
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('ward_number', wardNumber)
      .limit(20);

    if (agents) {
      results.push(...agents.map(agent => ({
        id: agent.id,
        type: 'agent' as const,
        title: agent.full_name,
        description: `Agent in Ward ${wardNumber} - ${agent.verification_status} - ${agent.payment_status}`,
        metadata: {
          phone: agent.phone_number,
          verification_status: agent.verification_status,
          payment_status: agent.payment_status,
          ward_name: agent.ward_name
        },
        relevance_score: 1,
        created_at: agent.created_at
      })));
    }

    // Find reports from this ward
    const { data: reports } = await supabase
      .from('reports')
      .select(`
        *,
        agents (
          full_name
        )
      `)
      .eq('ward_number', wardNumber)
      .limit(20);

    if (reports) {
      results.push(...reports.map(report => ({
        id: report.id,
        type: 'report' as const,
        title: `${report.report_type.replace('_', ' ')} - ${report.agents?.full_name || 'Unknown Agent'}`,
        description: report.details.substring(0, 150) + (report.details.length > 150 ? '...' : ''),
        metadata: {
          report_type: report.report_type,
          agent_name: report.agents?.full_name,
          ward_number: report.ward_number
        },
        relevance_score: 1,
        created_at: report.created_at
      })));
    }

    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}