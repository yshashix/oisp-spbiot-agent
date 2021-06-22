# IOT Agent Device GitOps Framework
Framework blueprint for GitOps Sequence Flow to OnBoard Gateway Devices for Industry Fusion.

## Installation Pre-Requisites:
In order to setup and onboard assets on your gateway you need to do the following:

Install and configure k3s:
=========================
Install the Lightweight Kubernetes k3s on gateway (root rights required).

Create namespace k3s:
==============================
```
kubectl create namespace oisp-devices
```

Install python3 and pip3 on your gateway:
========================================
```
sudo apt install python3
sudo apt install python3-pip
```
Install Packages with Pip using the Requirements Files:
======================================================
```
pip3 install -r requirements.txt
```
GitHub repos:
============

IndustryFusion-private-

machine-config repo

deployment-config-repo

gitops-repo

Store git credentials in cache for 30 days:
==========================================
```
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=2592000'
```
OISP Platform:
=============
Get access to OISP Platform Dashboard.

## Getting started
1. Clone this repository under your gateway.
2. Browse to the `oisp-iot-agent/container/kubernetes/onboarding/` directory.
3. Copy default config.json from IndustryFusion-private- git repository. This will set hosts for rest, ws and mqtt correctly 
   for OISP Platform DashBoard.
4. Create app_config.yaml which should consist of OISP Instance URL and APP Version.
Sample app_config.yaml description:
```
BASE_OISP_INSTANCE: <OISP_BASE_URL>
API_VERSION:   <vX/api>
```
5. Create gatewaydeployment.yaml which should consist of Application Name, Deployment Config, 
   Machine Config, GitOps Repo Config details for this framework to parse and deploy the devices you want to onboard connected to your gateway. 
Sample gatewaydeployment.yaml description:
```
version: <DEPLOYMENT_YAML_VERSION_NUMBER>
namespace: <NAMESPACE_FOR_ALL_DEPLOYMENTS>
CreateDeployments:
- ApplicationName: <DEPLOYMENT_NAME> 
    NodeName: <K3S_NODE_NAME>
    ToolVersion: <TOOL_VERSION>
    DeploymentConfig:
    	URL: <DEPLOYMENT_GIT_CONFIG_URL>
        Directory: <DEPLOYMENT_CONFIG_GIT_DIRECTORY_NAME>
        GitTag: <DEPLOYMENT_GIT_TAG_OR_COMMITID_OR_BRANCH>
    MachineConfig:
    	URL: <MACHINE_GIT_CONFIG_URL>,
       	Directory: <MACHINE_CONFIG_GIT_DIRECTORY_NAME>,
       	GitTag: <MACHINE_CONFIG_TAG_OR_COMMITID_OR_BRANCH>
    GitOpsRepo:
    	URL: <GITOPS_GIT_CONFIG_URL>,
       	Directory: <GITOPS_CONFIG_GIT_DIRECTORY_NAME>,
       	GitBranch: <GITOPS_BRANCH>
```
6. Initiate the Deployment process based on three actions; create, update or delete.
```
python3 deviceonboarding.py --action create --deployfilepath gatewaydeployment.yaml
===================================================================================
python3 deviceonboarding.py --action update --deployfilepath gatewaydeployment.yaml
===================================================================================
python3 deviceonboarding.py --action delete --deployfilepath gatewaydeployment.yaml
```
7. Once the onboarding script it initiated it will ask you for OISP platform credentials.
```
Gateway:~/tools $python3 deviceonboarding.py --action delete --deployfilepath gatewaydeployment.yaml
Deleting Pods....
Enter OISP User Credentials
Username: xxxx.xx@abc.com
Password:
If you multiple project account under single OISP Instance Below message will be generated.
==========================================================================================
Please choose one from below OISP account options
Account | name: None    id:3d14522e-3385-4c23-962a-3818d4983362 role:admin
Account | name: None    id:1d2c8140-0656-4f1b-ac18-875b17ed2e1e role:admin
Enter 0 for first account ID, 1 for second Account ID: 1
==================================================================================
Namespace oisp-devices already exists. Continue.
configmap "global-devices-config" deleted
configmap/global-devices-config created
secret "global-devices-secret" deleted
...........
```
8. After the Gitops deployment yaml is complied from different GitRepo's , We push the all.yaml 
   file to GitOpS Repo for Rancher-Fleet Plugin to initiate the OnBoarding process for the choosen Cluster and Node.
