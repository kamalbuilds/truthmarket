// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILayerZeroEndpointV2, Origin} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILayerZeroReceiver} from "./interfaces/ILayerZeroReceiver.sol";
import {IGenLayerBridgeReceiver} from "./interfaces/IGenLayerBridgeReceiver.sol";

/**
 * @title BridgeReceiver
 * @notice A simple contract that "receives" cross-chain messages from LayerZero Endpoint V2.
 *         It then dispatches the `_message` to a specified local contract or does logic directly.
 *         Only accepts messages from trusted remote BridgeForwarder contracts.
 */
contract BridgeReceiver is ILayerZeroReceiver, Ownable, ReentrancyGuard {
    ILayerZeroEndpointV2 public immutable endpoint;

    /// @dev Store the trusted remote forwarder for each chain: (remoteEid => remoteForwarder)
    mapping(uint32 => bytes32) public trustedForwarders;

    //--------------------------------------------------------------------------
    // Events
    //--------------------------------------------------------------------------
    /// @dev Emitted when a new trusted forwarder is set
    event TrustedForwarderSet(
        uint32 indexed remoteEid,
        bytes32 indexed remoteForwarder
    );

    /// @dev Emitted when a trusted forwarder is removed
    event TrustedForwarderRemoved(
        uint32 indexed remoteEid,
        bytes32 indexed remoteForwarder
    );

    /// @dev Emitted upon a successful local call within `lzReceive`
    event ForwardCallSuccess(
        uint32 indexed srcEid,
        bytes32 indexed srcSender,
        address localContract,
        bytes callData
    );

    /**
     * @notice The constructor that sets the local endpoint (LayerZeroEndpointV2) used for receiving cross-chain messages.
     * @param _endpoint The address of the local chain's LayerZeroEndpointV2 contract
     * @param initialOwner The address that will be the owner of this contract
     */
    constructor(address _endpoint, address initialOwner) Ownable(initialOwner) {
        require(_endpoint != address(0), "BridgeReceiver: _endpoint=0");
        endpoint = ILayerZeroEndpointV2(_endpoint);
    }

    /**
     * @notice Set the trusted remote forwarder for a specific chain
     * @param _remoteEid The remote chain's endpoint ID
     * @param _remoteForwarder The address of the BridgeForwarder on that chain (as bytes32)
     */
    function setTrustedForwarder(
        uint32 _remoteEid,
        bytes32 _remoteForwarder
    ) external onlyOwner {
        require(
            _remoteForwarder != bytes32(0),
            "BridgeReceiver: _remoteForwarder=0"
        );
        trustedForwarders[_remoteEid] = _remoteForwarder;
        emit TrustedForwarderSet(_remoteEid, _remoteForwarder);
    }

    /**
     * @notice Remove a trusted remote forwarder
     * @param _remoteEid The remote chain's endpoint ID to remove
     */
    function removeTrustedForwarder(uint32 _remoteEid) external onlyOwner {
        require(
            trustedForwarders[_remoteEid] != bytes32(0),
            "BridgeReceiver: no forwarder set"
        );
        emit TrustedForwarderRemoved(_remoteEid, trustedForwarders[_remoteEid]);
        delete trustedForwarders[_remoteEid];
    }

    //--------------------------------------------------------------------------
    // ILayerZeroReceiver OVERRIDES
    //--------------------------------------------------------------------------

    /**
     * @dev Called by Endpoint V2 to see if the path is "initialized."
     *      If we trust that `_origin.sender` is a valid remote,
     *      we can return true. Otherwise false.
     * @param _origin Info about the remote. { srcEid, sender, nonce }.
     * @return Whether we allow receiving from that remote
     */
    function allowInitializePath(
        Origin calldata _origin
    ) external view returns (bool) {
        // Only allow messages from trusted forwarders
        return trustedForwarders[_origin.srcEid] == _origin.sender;
    }

    /**
     * @dev For message ordering. If you want strict ordering, return the next nonce.
     *      Otherwise, returning 0 => means no ordering enforced at the OApp level.
     */
    function nextNonce(
        uint32 /*_eid*/,
        bytes32 /*_sender*/
    ) external pure returns (uint64) {
        return 0; // No ordering enforced
    }

    /**
     * @dev The main function called by the LayerZero executor to deliver a cross-chain message.
     * @param _origin The remote info: { srcEid, sender, nonce }
     * @param _message The cross-chain payload
     */
    function lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _message,
        address,
        bytes calldata
    ) external payable nonReentrant {
        require(
            msg.sender == address(endpoint),
            "BridgeReceiver: only Endpoint can call"
        );

        // Require the remote sender to be a trusted forwarder
        require(
            trustedForwarders[_origin.srcEid] == _origin.sender,
            "BridgeReceiver: untrusted forwarder"
        );

        // Decode the local contract and its callData
        (
            uint32 srcChainId,
            address srcSender,
            address localContract,
            bytes memory message
        ) = abi.decode(_message, (uint32, address, address, bytes));
        require(localContract != address(0), "BridgeReceiver: localContract=0");

        IGenLayerBridgeReceiver(localContract).processBridgeMessage(
            srcChainId,
            srcSender,
            message
        );

        // Emit an event upon success
        emit ForwardCallSuccess(
            _origin.srcEid,
            _origin.sender,
            localContract,
            message
        );
    }
}
