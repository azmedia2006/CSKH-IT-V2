"""Copy the live PostgreSQL tables into a fresh MySQL schema.

Required environment:
  DATABASE_URL: target MySQL URL
  POSTGRES_SOURCE_URL: read-only source PostgreSQL URL

The command refuses a non-empty destination and checks every copied row count.
"""
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import MetaData, Table, Text, inspect, text, select, func
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import BaseModel


def _decode_pg_value(value: Any, pg_type: str) -> Any:
    if value is None:
        return None
    if pg_type == "vector":
        if isinstance(value, str):
            return json.loads(value)
        return list(value)
    return value


async def migrate() -> None:
    source_url = os.environ.get("POSTGRES_SOURCE_URL")
    target_url = os.environ.get("DATABASE_URL")
    if not source_url or not target_url or not target_url.startswith("mysql+"):
        raise RuntimeError("Set POSTGRES_SOURCE_URL and a MySQL DATABASE_URL before running.")

    source_engine = create_async_engine(source_url)
    target_engine = create_async_engine(target_url)
    try:
        async with target_engine.begin() as target_conn:
            await target_conn.run_sync(BaseModel.metadata.create_all)
            target_tables = set(await target_conn.run_sync(lambda conn: inspect(conn).get_table_names()))
            for table in BaseModel.metadata.sorted_tables:
                if table.name in target_tables:
                    count = await target_conn.scalar(select(func.count()).select_from(table))
                    if count:
                        raise RuntimeError(f"Destination table {table.name} is not empty; refusing to overwrite.")

        async with source_engine.connect() as source_conn:
            await source_conn.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
            pg_tables = set((await source_conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
            ))).scalars().all())
            source_meta = MetaData()
            source_tables = {}
            source_types = {}
            for table in BaseModel.metadata.sorted_tables:
                if table.name not in pg_tables:
                    continue
                source_tables[table.name] = await source_conn.run_sync(
                    lambda sync_conn, name=table.name: Table(name, source_meta, autoload_with=sync_conn)
                )
                type_rows = await source_conn.execute(text(
                    "SELECT column_name, udt_name FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = :table_name"
                ), {"table_name": table.name})
                source_types[table.name] = {row.column_name: row.udt_name for row in type_rows}

            async with target_engine.begin() as target_conn:
                for target_table in BaseModel.metadata.sorted_tables:
                    source_table = source_tables.get(target_table.name)
                    if source_table is None:
                        continue
                    common_columns = [
                        col.name for col in target_table.columns
                        if col.name in source_table.c
                    ]
                    source_only_columns = set(source_table.c.keys()) - {col.name for col in target_table.columns}
                    if source_only_columns:
                        raise RuntimeError(
                            f"Source table {target_table.name} has columns not represented by the new model: "
                            f"{', '.join(sorted(source_only_columns))}. Add explicit mappings before migrating."
                        )
                    select_columns = []
                    for name in common_columns:
                        column = source_table.c[name]
                        if source_types[target_table.name].get(name) == "vector":
                            select_columns.append(column.cast(Text()).label(name))
                        else:
                            select_columns.append(column)
                    result = await source_conn.execute(select(*select_columns))
                    rows = result.mappings().all()
                    batches = []
                    for row in rows:
                        batches.append({
                            name: _decode_pg_value(row[name], source_types[target_table.name].get(name, ""))
                            for name in common_columns
                        })
                        if len(batches) >= 100:
                            await target_conn.execute(target_table.insert(), batches)
                            batches = []
                    if batches:
                        await target_conn.execute(target_table.insert(), batches)

                    copied_count = await target_conn.scalar(select(func.count()).select_from(target_table))
                    if copied_count != len(rows):
                        raise RuntimeError(
                            f"Row count mismatch for {target_table.name}: source={len(rows)}, target={copied_count}"
                        )
                    print(f"{target_table.name}: copied and verified {copied_count} rows")
    finally:
        await source_engine.dispose()
        await target_engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
