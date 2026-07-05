import { Helmet } from "react-helmet";
import "assets/css/admin.css";
import React from "react";
import AnnouncementCreationCard from "components/admin/AnnouncementCreationCard.tsx";
import { useAuthEnsurer } from "util/auth.ts";
import CompletionDeletionCard from "components/admin/CompletionDeletionCard.tsx";

export default function AdminPage() {
  useAuthEnsurer().ensureAdmin();

  return (
    <>
      <Helmet>
        <title>CTA - Admin</title>
      </Helmet>

      <div className="cards-container">
        <div className="cards-container__column">
          <AnnouncementCreationCard />
        </div>
        <div className="card-vertical-divider"></div>
        <div className="cards-container__column">
          <CompletionDeletionCard />
        </div>
      </div>
    </>
  );
}
