import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RpgDashboardPage } from './RpgDashboardPage';
import { RpgCharacterPage } from './RpgCharacterPage';
import { RpgCampaignsPage } from './RpgCampaignsPage';
import { RpgCampaignDetailPage } from './RpgCampaignDetailPage';

export const RpgRoutesPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<RpgDashboardPage />} />
      <Route path="personagem/:characterId" element={<RpgCharacterPage />} />
      <Route path="campanhas" element={<RpgCampaignsPage />} />
      <Route path="campanhas/:campaignId" element={<RpgCampaignDetailPage />} />
      <Route path="*" element={<Navigate to="/rpg" replace />} />
    </Routes>
  );
};
