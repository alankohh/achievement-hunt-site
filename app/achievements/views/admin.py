from datetime import datetime, timezone
import csv
import io

from django.views.decorators.http import require_POST, require_http_methods, require_GET
from django.contrib.auth import login as do_login
from django.shortcuts import redirect
from django.http.response import HttpResponse
from django.conf import settings
from django.db import connection

from common.validation import *
from .util import *
from common.comm import refresh_achievements_on_server
from .staff import serialize_full_achievement, with_user_rating


discord_logger = settings.DISCORD_LOGGER


@require_POST
@require_admin
@require_iteration
@accepts_json_data(DictionaryType({"title": StringType(1, 64), "message": StringType()}))
def create_announcement(req, data, iteration):
    announcement = Announcement.objects.create(
        iteration=iteration, title=data["title"], message=data["message"], created_at=datetime.now(tz=timezone.utc)
    )
    discord_logger.submit_announcement(announcement)
    return success(announcement.serialize())


@require_POST
@require_admin
@require_iteration
@accepts_json_data(DictionaryType({"release_time": IntegerType()}))
def create_batch(req, data, iteration):
    batch = AchievementBatch.objects.create(
        iteration=iteration, release_time=datetime.fromtimestamp(data["release_time"], tz=timezone.utc)
    )
    return success(batch.serialize())


@require_http_methods(["PATCH"])
@require_admin
@require_achievement(
    select=["creator", "batch"],
    prefetch=["comments__user", "beatmaps__info"],
    query_func=lambda req, query: with_user_rating(req.user.id, query),
)
@accepts_json_data(
    DictionaryType(
        {
            "batch_id": IntegerType(optional=True),
        }
    )
)
def change_achievement_batch(req, data, achievement):
    if data["batch_id"] is None:
        achievement.batch = None
        achievement.save()

        discord_logger.submit_achievement(req, achievement, "unmoved")
    else:
        batch = AchievementBatch.objects.filter(id=data["batch_id"]).first()
        if batch is None:
            return error("Invalid batch id")

        achievement.batch = batch
        achievement.save()

        discord_logger.submit_achievement(req, achievement, "moved")

    refresh_achievements_on_server()

    return success(serialize_full_achievement(achievement))


@require_admin
@require_GET
def login_to_user(req):
    user_id = req.GET.get("user_id")
    user = User.objects.get(id=user_id)
    do_login(req, user, backend=settings.AUTH_BACKEND)
    return redirect("index")


@require_admin
@require_iteration
@require_GET
def get_screening_info(req, iteration):
    players = Player.objects.select_related("team").filter(team__iteration_id=iteration.id).all()
    registrations = Registration.objects.select_related("user").filter(iteration_id=iteration.id).all()

    def get_team_name(user_id: int):
        return next((player.team.name for player in players if player.user_id == user_id), "Free agent")

    content = io.StringIO()
    writer = csv.writer(content)

    rows = []
    for reg in registrations:
        rows.append([reg.user.username, get_team_name(reg.user.id), reg.user.id])

    for row in sorted(rows, key=lambda x: x[1]):
        writer.writerow(row)

    response = HttpResponse(content.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="screening.csv"'
    return response


@require_admin
def update_iteration_cache(req):
    update_current_iteration()
    return HttpResponse("ok")


@require_http_methods(["DELETE"])
@require_admin
@accepts_json_data(
    DictionaryType(
        {
            "player_id": IntegerType(),
            "achievement_id": IntegerType(),
            "blacklist_scores": ListType(IntegerType()),
        }
    )
)
def remove_completion(req, data):
    completion = AchievementCompletion.objects.filter(
        player_id=data["player_id"], achievement_id=data["achievement_id"]
    ).first()
    if not completion:
        return error("Player does not have a completion on that achievement")

    blacklist_scores = data["blacklist_scores"]
    if len(blacklist_scores) > 0:
        cursor = connection.cursor()
        cursor.execute("""SELECT blacklisted_scores FROM score_blacklist WHERE player_id = %s""", [data["player_id"]])
        blacklist = cursor.fetchone()
        if not blacklist:
            cursor.execute(
                """INSERT INTO score_blacklist (player_id, blacklisted_scores) VALUES (%s, %s)""",
                [data["player_id"], json.dumps(blacklist_scores)],
            )
        else:
            cursor.execute(
                """UPDATE score_blacklist SET blacklisted_scores = %s WHERE player_id = %s""",
                (json.dumps(json.loads(blacklist[0]) + blacklist_scores), data["player_id"]),
            )

    completion.delete()

    return success({})
