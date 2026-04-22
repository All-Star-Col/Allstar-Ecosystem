# Tailscale Networking (Observed)

This document describes the networking behavior related to Tailscale that is visible in this repository.

Scope note: observable facts only. Unknowns are marked as `TBD`.

## Where Tailscale is used

- GitHub Actions workflow:
  - `.github/workflows/deploy-api.yml`
  - Job: `deploy_to_vm`
  - Action: `tailscale/github-action@v4`

## CI connectivity flow

1. The GitHub Actions runner authenticates to Tailscale with:
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`
2. The runner joins with tag:
   - `tag:ci`
3. The workflow verifies connectivity by running:
   - `tailscale status`
   - `tailscale ping -c 3 ${{ secrets.VM_TAILSCALE_IP }}`
   - `nc -vz ${{ secrets.VM_TAILSCALE_IP }} 22`
4. SSH session is established to:
   - `${{ secrets.VM_SSH_USER }}@${{ secrets.VM_TAILSCALE_IP }}`
5. Remote API deploy command is executed:
   - `/opt/allstar-api/deploy.sh`

## Network assumptions visible in repo

- API deployment path assumes SSH (TCP 22) is reachable via Tailnet.
- VM address source is `VM_TAILSCALE_IP` secret (not hard-coded in repo).
- Frontend deployment does not use Tailscale in workflow steps.

## Security and boundary notes

- SSH private key material is injected at runtime from GitHub secrets and written to `/tmp/id_key` in CI.
- Host key pinning is performed dynamically with `ssh-keyscan` during the workflow.

## TBD

- Tailnet ACL policy and who can use `tag:ci`.
- Whether MagicDNS names are used in production (workflow currently uses IP secret).
- VM-side firewall policy beyond the observed SSH reachability check.
- Whether API ingress is exclusively Tailnet or also exposed through public networking.
