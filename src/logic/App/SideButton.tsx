import React, { useState } from "react";
import { Graph } from "../Graph";
import { Editor } from "../Editor";
import { Config, ConfigOptionsPropViewType } from "../Config";
import { Form } from "react-bootstrap";
import './SideButtonStyle';

export function SideButton(props: { desc: React.ReactNode, onClick: () => void, children: any }) {

    return <div className="side-btn">
        <div className="side-btn-desc">{props.desc}</div>
        <div className="side-btn-content" onClick={() => props.onClick()}>{props.children}</div>
    </div>;
}
