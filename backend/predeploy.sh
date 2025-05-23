#!/bin/bash
# predeploy.sh

echo "Running database migrations..."
python db_migration.py

echo "Predeploy tasks completed"