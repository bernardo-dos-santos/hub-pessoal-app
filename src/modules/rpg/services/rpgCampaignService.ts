import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type RpgCampaign, type RpgCampaignStatus } from '../types/rpg';

const STORAGE_KEY = 'rpg.campaigns';

let memoryCampaigns: RpgCampaign[] | null = null;

export type RpgCampaignInput = {
  name: string;
  system?: string;
  gm?: string;
  status?: RpgCampaignStatus;
  notes?: string;
};

function readCampaigns(): RpgCampaign[] {
  return storageAdapter.getItem<RpgCampaign[]>(STORAGE_KEY) ?? memoryCampaigns ?? [];
}

function writeCampaigns(campaigns: RpgCampaign[]): void {
  memoryCampaigns = campaigns;
  storageAdapter.setItem(STORAGE_KEY, campaigns);
}

export const rpgCampaignService = {
  list(): RpgCampaign[] {
    return readCampaigns();
  },

  get(id: string): RpgCampaign | null {
    return readCampaigns().find((campaign) => campaign.id === id) ?? null;
  },

  create(input: RpgCampaignInput): RpgCampaign {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Dê um nome à campanha.');
    }

    const now = new Date().toISOString();
    const campaign: RpgCampaign = {
      id: generateId('campaign'),
      name,
      system: input.system?.trim() || undefined,
      gm: input.gm?.trim() || undefined,
      status: input.status ?? 'active',
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    writeCampaigns([campaign, ...readCampaigns()]);
    return campaign;
  },

  update(id: string, updates: Partial<RpgCampaignInput>): RpgCampaign | null {
    const campaigns = readCampaigns();
    const campaign = campaigns.find((current) => current.id === id);
    if (!campaign) {
      return null;
    }

    const name = updates.name === undefined ? campaign.name : updates.name.trim();
    if (!name) {
      throw new Error('Dê um nome à campanha.');
    }

    const updated: RpgCampaign = {
      ...campaign,
      ...updates,
      name,
      system: updates.system === undefined ? campaign.system : updates.system.trim() || undefined,
      gm: updates.gm === undefined ? campaign.gm : updates.gm.trim() || undefined,
      notes: updates.notes === undefined ? campaign.notes : updates.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    writeCampaigns(campaigns.map((current) => (current.id === id ? updated : current)));
    return updated;
  },

  remove(id: string): boolean {
    const campaigns = readCampaigns();
    const next = campaigns.filter((campaign) => campaign.id !== id);
    if (next.length === campaigns.length) {
      return false;
    }

    writeCampaigns(next);
    return true;
  },
};
