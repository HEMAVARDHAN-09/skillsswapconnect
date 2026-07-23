REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_session_update(uuid, uuid, text, text, uuid, uuid, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_session(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_suspicious_rpc_activity(integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_rpc_call(text, jsonb, boolean, text) FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_session_update(uuid, uuid, text, text, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_suspicious_rpc_activity(integer, integer) TO authenticated;