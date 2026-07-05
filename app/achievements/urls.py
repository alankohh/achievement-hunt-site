from django.urls import path
from django.conf import settings

from .views import common, staff, admin

# endpoints that depend on the iteration
iteration_urls = [
    path("achievements/", common.achievements),
    path("completions/", common.achievement_completions),
    path("teams/", common.teams),
    path("teams/leave/", common.leave_team),
    path("teams/create/", common.create_team),
    path("teams/rename/", common.rename_team),
    path("teams/transfer/", common.transfer_admin),
    path("teams/messages/", common.chat_messages),
    path("teams/invites/", common.get_team_invites),
    path("teams/invites/create/", common.send_team_invite),
    path("teams/accept-free-agents/", common.change_accepting_free_agents),
    path("invites/", common.get_user_invites),
    path("stats/", common.player_stats),
    path("registration/change/", common.change_registration),
    path("registration/", common.get_registration),
    path("registrations/", common.get_all_registrations),
    path("registration/free-agent/change/", common.change_free_agent),
    path("announcements/", common.get_announcements),
    path("announcements/create/", admin.create_announcement),
    path("staff/achievements/", staff.achievements),
    path("staff/batches/", staff.get_batches),
    path("staff/batches/create/", admin.create_batch),
    path("screening/", admin.get_screening_info),
]

# these do not depend on the iteration
urlpatterns = (
    [
        path("login/", common.login),
        path("logout/", common.logout),
        path("admin-login/", admin.login_to_user),
        path("admin/update-iteration-cache/", admin.update_iteration_cache),
        path("admin/completions/delete/", admin.remove_completion),
        path("iteration/", common.get_iteration),
        path("iterations/<int:iteration_id>/", common.get_iteration),
        path("invites/<int:invite_id>/rescind/", common.rescind_invite),
        path("invites/<int:invite_id>/resolve/", common.resolve_invite),
        path("achievements/<int:achievement_id>/", common.achievement),
        path("staff/achievements/<int:achievement_id>/", staff.show_achievement),
        path("staff/achievements/<int:achievement_id>/rate/", staff.set_achievement_rating),
        path("staff/achievements/<int:achievement_id>/comment/", staff.create_comment),
        path("staff/achievements/<int:achievement_id>/edit/", staff.edit_achievement),
        path("staff/achievements/<int:achievement_id>/delete/", staff.delete_achievement),
        path("staff/achievements/<int:achievement_id>/move/", admin.change_achievement_batch),
        path("staff/achievements/<int:achievement_id>/mark-solved/", staff.mark_as_solved),
        path("staff/achievements/<int:achievement_id>/pw-guess/", staff.submit_password_guess),
        path("staff/comments/<int:comment_id>/edit/", staff.edit_comment),
        path("staff/comments/<int:comment_id>/delete/", staff.delete_comment),
        path("staff/achievements/create/", staff.create_achievement),
        path("staff/playtest/passkey/", staff.get_playtest_passkey),
        path("staff/algorithm-docs/", staff.request_algorithm_docs),
    ]
    + iteration_urls
    + [path("iterations/<int:iteration_id>/" + url.pattern._route, url.callback) for url in iteration_urls]
)

if settings.DEBUG:
    urlpatterns.append(path("debug-login/", common.debug_login))
