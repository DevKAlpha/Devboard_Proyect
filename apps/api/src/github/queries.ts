/**
 * GraphQL documents for GitHub Projects (v2). Every operation is named
 * `Devbord<Something>`: the fake GitHub (GITHUB_FAKE) dispatches on that name.
 */

export const VIEWER = /* GraphQL */ `
  query DevbordViewer {
    viewer {
      login
      avatarUrl
    }
  }
`;

const PROJECT_SUMMARY = `id number title url closed owner { ... on Organization { login } ... on User { login } }`;

/** Projects the user can open: their own and their organizations'. */
export const PROJECTS = /* GraphQL */ `
  query DevbordProjects {
    viewer {
      login
      projectsV2(first: 50) { nodes { ${PROJECT_SUMMARY} } }
      organizations(first: 50) {
        nodes { login projectsV2(first: 50) { nodes { ${PROJECT_SUMMARY} } } }
      }
    }
  }
`;

const FIELD_ID = `field { ... on ProjectV2FieldCommon { id } }`;

/** One page of a Project: fields, linked repos and items in board order. */
export const PROJECT = /* GraphQL */ `
  query DevbordProject($id: ID!, $after: String) {
    node(id: $id) {
      ... on ProjectV2 {
        id
        number
        title
        url
        createdAt
        owner { ... on Organization { login } ... on User { login } }
        repositories(first: 5) {
          nodes {
            id
            nameWithOwner
            labels(first: 100) { nodes { id name color } }
            assignableUsers(first: 100) { nodes { login avatarUrl } }
          }
        }
        fields(first: 50) {
          nodes {
            __typename
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField { options { id name } }
            ... on ProjectV2IterationField {
              configuration {
                iterations { id title startDate duration }
                completedIterations { id title startDate duration }
              }
            }
          }
        }
        items(first: 100, after: $after, orderBy: { field: POSITION, direction: ASC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isArchived
            fieldValues(first: 30) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue { optionId ${FIELD_ID} }
                ... on ProjectV2ItemFieldNumberValue { number ${FIELD_ID} }
                ... on ProjectV2ItemFieldIterationValue { iterationId title ${FIELD_ID} }
                ... on ProjectV2ItemFieldDateValue { date ${FIELD_ID} }
              }
            }
            content {
              __typename
              ... on DraftIssue { id title body createdAt updatedAt }
              ... on Issue {
                id number title body url state createdAt updatedAt
                repository { nameWithOwner }
                labels(first: 20) { nodes { id name color } }
                assignees(first: 10) { nodes { login avatarUrl } }
                parent { id number title url }
                subIssuesSummary { total completed }
                closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
                  nodes { number title url state isDraft merged }
                }
              }
              ... on PullRequest {
                id number title body url state isDraft merged createdAt updatedAt
                repository { nameWithOwner }
                labels(first: 20) { nodes { id name color } }
                assignees(first: 10) { nodes { login avatarUrl } }
              }
            }
          }
        }
      }
    }
  }
`;

// ── Mutations ────────────────────────────────────────────────────────────────

export const CREATE_ISSUE = /* GraphQL */ `
  mutation DevbordCreateIssue($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
      issue {
        id
      }
    }
  }
`;

export const ADD_ITEM = /* GraphQL */ `
  mutation DevbordAddItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item {
        id
      }
    }
  }
`;

export const ADD_DRAFT = /* GraphQL */ `
  mutation DevbordAddDraft($projectId: ID!, $title: String!, $body: String) {
    addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
      projectItem {
        id
      }
    }
  }
`;

export const SET_FIELD = /* GraphQL */ `
  mutation DevbordSetField(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
    $value: ProjectV2FieldValue!
  ) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }
    ) {
      projectV2Item {
        id
      }
    }
  }
`;

export const CLEAR_FIELD = /* GraphQL */ `
  mutation DevbordClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }
    ) {
      projectV2Item {
        id
      }
    }
  }
`;

export const POSITION = /* GraphQL */ `
  mutation DevbordPosition($projectId: ID!, $itemId: ID!, $afterId: ID) {
    updateProjectV2ItemPosition(
      input: { projectId: $projectId, itemId: $itemId, afterId: $afterId }
    ) {
      clientMutationId
    }
  }
`;

export const UPDATE_ISSUE = /* GraphQL */ `
  mutation DevbordUpdateIssue($id: ID!, $title: String, $body: String, $labelIds: [ID!]) {
    updateIssue(input: { id: $id, title: $title, body: $body, labelIds: $labelIds }) {
      issue {
        id
      }
    }
  }
`;

export const UPDATE_PULL_REQUEST = /* GraphQL */ `
  mutation DevbordUpdatePullRequest($id: ID!, $title: String, $body: String, $labelIds: [ID!]) {
    updatePullRequest(
      input: { pullRequestId: $id, title: $title, body: $body, labelIds: $labelIds }
    ) {
      pullRequest {
        id
      }
    }
  }
`;

export const UPDATE_DRAFT = /* GraphQL */ `
  mutation DevbordUpdateDraft($id: ID!, $title: String, $body: String) {
    updateProjectV2DraftIssue(input: { draftIssueId: $id, title: $title, body: $body }) {
      draftIssue {
        id
      }
    }
  }
`;

export const CLOSE_ISSUE = /* GraphQL */ `
  mutation DevbordCloseIssue($id: ID!) {
    closeIssue(input: { issueId: $id, stateReason: COMPLETED }) {
      issue {
        id
      }
    }
  }
`;

export const REOPEN_ISSUE = /* GraphQL */ `
  mutation DevbordReopenIssue($id: ID!) {
    reopenIssue(input: { issueId: $id }) {
      issue {
        id
      }
    }
  }
`;

export const DELETE_ITEM = /* GraphQL */ `
  mutation DevbordDeleteItem($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      deletedItemId
    }
  }
`;

export const ADD_SUB_ISSUE = /* GraphQL */ `
  mutation DevbordAddSubIssue($issueId: ID!, $subIssueId: ID!) {
    addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId, replaceParent: true }) {
      issue {
        id
      }
    }
  }
`;

export const REMOVE_SUB_ISSUE = /* GraphQL */ `
  mutation DevbordRemoveSubIssue($issueId: ID!, $subIssueId: ID!) {
    removeSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
      issue {
        id
      }
    }
  }
`;

export const RENAME_PROJECT = /* GraphQL */ `
  mutation DevbordRenameProject($projectId: ID!, $title: String!) {
    updateProjectV2(input: { projectId: $projectId, title: $title }) {
      projectV2 {
        id
      }
    }
  }
`;
