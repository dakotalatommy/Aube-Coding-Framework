from typing import Set
from src.backend.app.db import engine
from src.backend.app import models as dbm


def quote_ident(name: str) -> str:
	return '"' + name.replace('"', '""') + '"'


def main() -> int:
	with engine.begin() as conn:
		# Drop all existing policies in public schema using Python iteration
		rows = conn.exec_driver_sql(
			"SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public'"
		).fetchall()
		for schemaname, tablename, policyname in rows:
			safe_policy = policyname.replace('"', '""')
			safe_schema = schemaname.replace('"', '""')
			safe_table = tablename.replace('"', '""')
			sql = f'DROP POLICY IF EXISTS "{safe_policy}" ON "{safe_schema}"."{safe_table}";'
			conn.exec_driver_sql(sql)

		# Determine model tables we manage
		model_tables: Set[str] = {t.name for t in dbm.Base.metadata.sorted_tables}  # type: ignore

		# Discover existing tables to avoid operating on missing relations
		existing_rows = conn.exec_driver_sql("SELECT tablename FROM pg_tables WHERE schemaname='public'").fetchall()
		existing_tables = {r[0] for r in existing_rows}

		# Enable/force RLS and create two clean policies per table
		for t in sorted(model_tables):
			if t not in existing_tables:
				# Skip tables that don't exist in this database
				continue
			qt = quote_ident(t)
			conn.exec_driver_sql(f"ALTER TABLE IF EXISTS {qt} ENABLE ROW LEVEL SECURITY;")
			conn.exec_driver_sql(f"ALTER TABLE IF EXISTS {qt} FORCE ROW LEVEL SECURITY;")

			# Drop named policies if present then recreate cleanly (avoids duplicate errors)
			conn.exec_driver_sql(f"DROP POLICY IF EXISTS tenant_isolation ON {qt};")
			conn.exec_driver_sql(f"DROP POLICY IF EXISTS admin_bypass ON {qt};")
			# tenant_isolation
			conn.exec_driver_sql(
				(
					"CREATE POLICY tenant_isolation ON {qt} "
					"USING (tenant_id::text = current_setting('app.tenant_id', true)) "
					"WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true))"
				).format(qt=qt)
			)
			# admin_bypass
			conn.exec_driver_sql(
				(
					"CREATE POLICY admin_bypass ON {qt} "
					"USING (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true)) "
					"WITH CHECK (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true))"
				).format(qt=qt)
			)

	print("Policies reset and reapplied for tables:")
	for t in sorted(model_tables):
		print(" -", t)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())


