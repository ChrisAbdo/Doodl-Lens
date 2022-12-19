import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import {
  client,
  challenge,
  authenticate,
  getDefaultProfile,
  signCreatePostTypedData,
  lensHub,
  splitSignature,
  validateMetadata,
} from '../api';
import { create } from 'ipfs-http-client';
import { v4 as uuid } from 'uuid';

const projectId = '2J7gzkVno2rLR8hSKPj3VyADGZp';
const projectSecret = '8242b4c443bad5c8f3e41456677d553a';
const auth =
  'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: auth,
  },
});

export default function Home() {
  const [address, setAddress] = useState();
  const [session, setSession] = useState(null);
  const [postData, setPostData] = useState('');
  const [profileId, setProfileId] = useState('');
  const [handle, setHandle] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) {
      setAddress(accounts[0]);
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: accounts[0] },
      });
      setProfileId(response.data.defaultProfile.id);
      setHandle(response.data.defaultProfile.handle);
    }
  }

  async function connectAndAuthenticate() {
    await connect();
    await login();
  }

  async function connect() {
    const account = await window.ethereum.send('eth_requestAccounts');
    if (account.result.length) {
      setAddress(account.result[0]);
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: account[0] },
      });
      setProfileId(response.data.defaultProfile.id);
      setHandle(response.data.defaultProfile.handle);
    }
  }

  async function login() {
    try {
      const challengeInfo = await client.query({
        query: challenge,
        variables: {
          address,
        },
      });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(
        challengeInfo.data.challenge.text
      );
      const authData = await client.mutate({
        mutation: authenticate,
        variables: {
          address,
          signature,
        },
      });

      const {
        data: {
          authenticate: { accessToken },
        },
      } = authData;
      localStorage.setItem('lens-auth-token', accessToken);
      setToken(accessToken);
      setSession(authData.data.authenticate);
    } catch (err) {
      console.log('Error signing in: ', err);
    }
  }

  async function createPost() {
    if (!postData) return;
    const ipfsData = await uploadToIPFS();
    const createPostRequest = {
      profileId,
      contentURI: 'ipfs://' + ipfsData.path,
      collectModule: {
        freeCollectModule: { followerOnly: true },
      },
      referenceModule: {
        followerOnlyReferenceModule: false,
      },
    };
    try {
      const signedResult = await signCreatePostTypedData(
        createPostRequest,
        token
      );
      const typedData = signedResult.result.typedData;
      const { v, r, s } = splitSignature(signedResult.signature);
      const tx = await lensHub.postWithSig({
        profileId: typedData.value.profileId,
        contentURI: typedData.value.contentURI,
        collectModule: typedData.value.collectModule,
        collectModuleInitData: typedData.value.collectModuleInitData,
        referenceModule: typedData.value.referenceModule,
        referenceModuleInitData: typedData.value.referenceModuleInitData,
        sig: {
          v,
          r,
          s,
          deadline: typedData.value.deadline,
        },
      });
      console.log('successfully created post: tx hash', tx.hash);
    } catch (err) {
      console.log('error posting publication: ', err);
    }
  }

  async function uploadToIPFS() {
    const metaData = {
      version: '2.0.0',
      content: postData,
      description: postData,
      name: `Post by @${handle}`,
      external_url: `https://lenster.xyz/u/${handle}`,
      metadata_id: uuid(),
      mainContentFocus: 'TEXT_ONLY',
      attributes: [],
      locale: 'en-US',
    };

    const result = await client.query({
      query: validateMetadata,
      variables: {
        metadatav2: metaData,
      },
    });
    console.log('Metadata verification request: ', result);

    const added = await ipfsClient.add(JSON.stringify(metaData));
    return added;
  }

  function onChange(e) {
    setPostData(e.target.value);
  }

  return (
    <div>
      {/* {!address && <button onClick={connect}>Connect</button>}
      {address && !session && (
        <div onClick={login}>
          <button className="border border-black">Login</button>
        </div>
      )}
      {address && session && (
        <div>
          <textarea onChange={onChange} />
          <button onClick={createPost}>Create Post</button>
        </div>
      )} */}
      <div className="navbar bg-base-100 border-b-2 border-black">
        <div className="navbar-start">
          <div className="dropdown">
            <label tabIndex={0} className="btn btn-ghost lg:hidden">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h8m-8 6h16"
                />
              </svg>
            </label>
            <ul
              tabIndex={0}
              className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li>
                <a>Item 1</a>
              </li>
              <li tabIndex={0}>
                <a className="justify-between">
                  Parent
                  <svg
                    className="fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                  </svg>
                </a>
                <ul className="p-2">
                  <li>
                    <a>Submenu 1</a>
                  </li>
                  <li>
                    <a>Submenu 2</a>
                  </li>
                </ul>
              </li>
              <li>
                <a>Item 3</a>
              </li>
            </ul>
          </div>
          <a className="btn btn-ghost normal-case text-xl">daisyUI</a>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a>Item 1</a>
            </li>
            <li tabIndex={0}>
              <a>
                Parent
                <svg
                  className="fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                >
                  <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
                </svg>
              </a>
              <ul className="p-2">
                <li>
                  <a>Submenu 1</a>
                </li>
                <li>
                  <a>Submenu 2</a>
                </li>
              </ul>
            </li>
            <li>
              <a>Item 3</a>
            </li>
          </ul>
        </div>
        <div className="navbar-end">
          <button onClick={connect} className="btn btn-ghost">
            Connect
          </button>
          {address ? (
            <button
              onClick={login}
              className="relative inline-block px-4 py-2 font-medium group"
            >
              <span className="absolute inset-0 w-full h-full transition duration-200 ease-out transform translate-x-1 translate-y-1 bg-black group-hover:-translate-x-0 group-hover:-translate-y-0"></span>
              <span className="absolute inset-0 w-full h-full bg-white border-2 border-black group-hover:bg-black"></span>
              <span className="relative text-black group-hover:text-white">
                {address.slice(0, 5)}...
                {address.slice(address.length - 4, address.length)}
              </span>
            </button>
          ) : (
            <button
              onClick={connectAndAuthenticate}
              className="relative inline-block px-4 py-2 font-medium group"
            >
              <span className="absolute inset-0 w-full h-full transition duration-200 ease-out transform translate-x-1 translate-y-1 bg-black group-hover:-translate-x-0 group-hover:-translate-y-0"></span>
              <span className="absolute inset-0 w-full h-full bg-white border-2 border-black group-hover:bg-black"></span>
              <span className="relative text-black group-hover:text-white">
                Sign In with Lens
              </span>
            </button>
          )}
        </div>
      </div>

      {address && (
        <div>
          <textarea onChange={onChange} />
          <button onClick={createPost}>Create Post</button>
        </div>
      )}
    </div>
  );
}
