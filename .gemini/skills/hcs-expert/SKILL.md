---
name: hcs-expert
description: Specialized guidance for Huawei Cloud Stack (HCS) API testing and DevOps workflows. Use when working with HCS services (ECS, VPC, IAM, OBS, etc.), managing Bruno collections, or debugging HCS-specific authentication and networking issues.
---

# HCS Expert Skill

This skill provides expert procedural knowledge for managing and testing Huawei Cloud Stack (HCS) environments using the Bruno API client and DevOps best practices.

## Core Workflows

### 1. Authentication (IAM)
Most HCS services require an `X-Auth-Token`.
- **Workflow**: 
  1. Call the `Auth -> Get Token` or `IAM -> Get Token` request.
  2. The `auth_token` variable is automatically updated in the environment.
- **Header**: `X-Auth-Token: {{auth_token}}`
- **AK/SK**: Some services (like OBS) may use Access Key (AK) and Secret Key (SK) for authentication.

### 2. Environment Management
Variables are defined in `HCS API Collection/environments/hcs.yml`.
- **Endpoints**: Most endpoints follow the pattern `https://[service].[region].[cloud-domain]`.
- **Project ID**: Required for many resource-specific operations (e.g., `cee92204...`).
- **Availability Zone**: Standard HCS AZs like `kvm.az1`.

### 3. API Testing with Bruno CLI
Use the `bru` CLI to run collections programmatically.
- **Run a folder**: `bru run "HCS API Collection/ECS" --env hcs`
- **Generate Report**: `bru run "HCS API Collection/VPC" --env hcs --output results.json`

## Service-Specific Guidance

| Service | Key Concepts | Common Tasks |
|---------|--------------|--------------|
| **ECS** | Flavors, Images, Security Groups | Create Instance, Resize, Start/Stop |
| **VPC** | Subnets, Security Groups, EIP | Create VPC, Add SG Rules, Bind EIP |
| **OBS** | Buckets, Objects, ACLs | Put/Get Object, List Buckets |
| **CCE** | Clusters, Nodes, K8s | Create Cluster, Add Node |
| **RDS** | Databases, Backups, Users | Create DB, Manage Backups |

## Troubleshooting HCS APIs
- **401 Unauthorized**: Token expired or incorrect credentials in `hcs.yml`.
- **403 Forbidden**: User lacks permissions for the specific project/resource.
- **404 Not Found**: Incorrect endpoint or invalid resource ID.
- **Networking**: Ensure the runner has network access to the `*.itn.intraorange` domain.

## References
- Refer to `HCS API Collection/opencollection.yml` for global headers and scripts.
- Refer to service-specific `folder.yml` for local configurations.
