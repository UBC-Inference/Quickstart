---
title: Serverless Inference Platform
author:
    name: Kevin Xiao
    url: https://kxiao.dev
    image: https://media.licdn.com/dms/image/v2/D5603AQEE683SF9HjqA/profile-displayphoto-scale_200_200/B56ZyC0Iz5KsAY-/0/1771721233394?e=2147483647&v=beta&t=AzmvOh-LaEPlzrzv8BOajL1zMrNGwydWLexQULVWQ_M
---

## Problem Statement

Inference is an expensive operation, oftentimes requiring specialized hardware (accelerators), is intensive on resource utilization under load, and for many forms of workloads (e.g. asynchronous inference jobs, batch processed financial data, image pre-processing) don't require dedicated servers or uptime. Inference is not only a resource management problem, but it's also far more expensive to procure on-prem hardware and is typically an order of magnitude more expensive than elastic compute for rental/usage (don't quote me on this fact). This project focuses on inference for LLMs but could potentially be used for other modalities/applications.

SIP is a serverless platform built for inference workloads, namely to enable multi-tenant resource sharing while providing reasonable performance (in terms of overhead/cold start time) and an ergonomic framework for deployment. 

## Goals

1. Learning

## Requirements

### Functional Requirements

### Non Functional Requirements

## Design

