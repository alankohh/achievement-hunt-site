import { Helmet } from "react-helmet";
import Achievement from "../components/achievements/Achievement.tsx";
import { useGetAchievement } from "api/query.ts";
import { useParams } from "react-router-dom";
import { NotFoundError } from "../errors/NotFoundError.ts";

export default function AchievementPage() {
  const params = useParams();

  let achievementIdParam = params.achievementId;
  if (achievementIdParam === undefined) {
    throw new NotFoundError();
  }

  const achievementId = parseInt(achievementIdParam as string);
  if (isNaN(achievementId)) {
    throw new NotFoundError();
  }

  const { data: achievement, isLoading } = useGetAchievement(achievementId);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (achievement === undefined) {
    return <div>Error loading achievement</div>;
  }

  return (
    <>
      <Helmet>
        <title>CTA - Staff Achievement</title>
      </Helmet>
      <div className="staff__page">
        <div className="staff__achievement-container">
          <Achievement
            achievement={achievement}
            completed="none"
            points={null}
            teamsMap={{}}
            playersMap={{}}
            iterationEnded={true}
            competitionScorings={[]}
          />
        </div>
      </div>
    </>
  );
}
