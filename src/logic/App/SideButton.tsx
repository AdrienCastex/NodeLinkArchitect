import React from "react";
import './SideButtonStyle';

export function SideButton(props: { desc: React.ReactNode, forceOpen?: boolean, onClick: () => void, children: any, sideItems?: React.ReactNode[] }) {

    return <div className={"side-btn " + (props.forceOpen ? 'force-open' : '')}>
        <div className="side-btn-desc">{props.desc}</div>
        {props.sideItems && props.sideItems.length > 0 ? <div className="side-btn-items">{props.sideItems}</div> : undefined}
        <div className="side-btn-content" onClick={() => props.onClick()}>{props.children}</div>
    </div>;
}
