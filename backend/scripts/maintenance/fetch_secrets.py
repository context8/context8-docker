import modal
import os
import json

app = modal.App("fetch-secrets")

@app.function(
    secrets=[
        modal.Secret.from_name("jwt-secret"),
        modal.Secret.from_name("resend-key"),
        modal.Secret.from_name("api-key-secret"),
        modal.Secret.from_name("postgres-credentials"),
    ]
)
def get_secrets():
    """Get all secret values"""
    secrets_data = {}

    # Collect all environment variables
    for key, value in os.environ.items():
        secrets_data[key] = value

    return secrets_data

@app.local_entrypoint()
def main():
    result = get_secrets.remote()

    # Print in a readable format
    print("\n" + "="*60)
    print("SECRETS FROM MODAL (ybpang-1 workspace)")
    print("="*60)

    # Filter and display relevant secrets
    print("\n=== JWT Secret ===")
    for key, value in result.items():
        if 'jwt' in key.lower():
            print(f"{key} = {value}")

    print("\n=== Resend Key ===")
    for key, value in result.items():
        if 'resend' in key.lower():
            print(f"{key} = {value}")

    print("\n=== API Key Secret ===")
    for key, value in result.items():
        if 'api' in key.lower() and 'key' in key.lower():
            print(f"{key} = {value}")

    print("\n=== Postgres Credentials ===")
    for key, value in result.items():
        if any(word in key.lower() for word in ['postgres', 'database', 'db_']):
            print(f"{key} = {value}")

    # Save to a JSON file
    output_file = "modal_secrets.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    print("\n" + "="*60)
    print(f"All secrets saved to: {output_file}")
    print("="*60)
